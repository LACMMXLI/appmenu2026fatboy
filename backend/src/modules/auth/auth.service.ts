import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { argon2id, hash as argon2Hash, verify as argon2Verify } from 'argon2';
import { pbkdf2Sync, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

// Legacy PBKDF2 format: <32-char hexadecimal salt>:<128-char hexadecimal SHA-512 key>.
const LEGACY_PBKDF2_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{128}$/i;
// Modern hashes use the standard PHC string format emitted by Argon2id: $argon2id$...
const ARGON2ID_PREFIX = '$argon2id$';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async hashPassword(password: string): Promise<string> {
    return argon2Hash(password, ARGON2_OPTIONS);
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (this.isArgon2idHash(storedHash)) {
      try {
        return await argon2Verify(storedHash, password);
      } catch {
        return false;
      }
    }

    if (!this.isLegacyPbkdf2Hash(storedHash)) return false;

    const [salt, expectedHashHex] = storedHash.split(':');
    const expectedHash = Buffer.from(expectedHashHex, 'hex');
    const calculatedHash = pbkdf2Sync(password, salt, 1000, expectedHash.length, 'sha512');

    return expectedHash.length === calculatedHash.length && timingSafeEqual(expectedHash, calculatedHash);
  }

  async register(body: unknown) {
    const input = this.requireBody(body);
    const name = this.validateName(input.name);
    const phone = this.validatePhone(input.phone);
    const password = this.validateNewPassword(input.password);
    const favoriteBranchId = this.optionalString(input.favoriteBranchId, 'sucursal favorita');

    const existing = await this.prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('Este número de teléfono ya está registrado.');
    }

    const hashedPassword = await this.hashPassword(password);
    const customer = await this.prisma.customer.create({
      data: {
        id: randomUUID(),
        name,
        phone,
        password: hashedPassword,
        favoriteBranchId,
        points: 0,
      },
    });

    const session = await this.createSession(customer.id);
    return { token: session.id, customer: this.sanitizeCustomer(customer) };
  }

  async login(body: unknown) {
    const input = this.requireBody(body, true);
    const phone = this.loginPhone(input.phone);
    const password = this.loginPassword(input.password);

    if (!phone || !password) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos.');
    }

    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer || !(await this.verifyPassword(password, customer.password))) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos.');
    }

    if (this.isLegacyPbkdf2Hash(customer.password)) {
      const modernHash = await this.hashPassword(password);
      await this.prisma.customer.updateMany({
        where: { id: customer.id, password: customer.password },
        data: { password: modernHash },
      });
    }

    const session = await this.createSession(customer.id);
    return { token: session.id, customer: this.sanitizeCustomer(customer) };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { id: token } });
    return { ok: true };
  }

  async validateSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: token },
      include: { customer: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: token } });
      }
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    return this.sanitizeCustomer(session.customer);
  }

  async updateProfile(customerId: string, body: unknown) {
    const input = this.requireBody(body);
    const name = input.name !== undefined ? this.validateName(input.name) : undefined;
    const phone = input.phone !== undefined ? this.validatePhone(input.phone) : undefined;
    const favoriteBranchId = input.favoriteBranchId !== undefined
      ? this.optionalString(input.favoriteBranchId, 'sucursal favorita')
      : undefined;

    if (phone) {
      const existing = await this.prisma.customer.findUnique({ where: { phone } });
      if (existing && existing.id !== customerId) {
        throw new ConflictException('Este número de teléfono ya está registrado por otro cliente.');
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(favoriteBranchId !== undefined ? { favoriteBranchId } : {}),
      },
    });

    return this.sanitizeCustomer(updated);
  }

  async changePassword(customerId: string, body: unknown) {
    const input = this.requireBody(body);
    const oldPassword = this.loginPassword(input.oldPassword);
    const newPassword = this.validateNewPassword(input.newPassword, 'La nueva contraseña');

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!oldPassword || !customer || !(await this.verifyPassword(oldPassword, customer.password))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        password: await this.hashPassword(newPassword),
      },
    });

    return { ok: true };
  }

  private async createSession(customerId: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.session.create({
      data: {
        id: randomUUID(),
        customerId,
        expiresAt,
      },
    });
  }

  private isLegacyPbkdf2Hash(storedHash: string): boolean {
    return LEGACY_PBKDF2_PATTERN.test(storedHash);
  }

  private isArgon2idHash(storedHash: string): boolean {
    return typeof storedHash === 'string' && storedHash.startsWith(ARGON2ID_PREFIX);
  }

  private validateNewPassword(value: unknown, label = 'La contraseña'): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${label} debe ser texto.`);
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`${label} debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    if (value.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(`${label} no puede exceder ${MAX_PASSWORD_LENGTH} caracteres.`);
    }
    return value;
  }

  private loginPassword(value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PASSWORD_LENGTH) return null;
    return value;
  }

  private validateName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('El nombre debe ser texto.');
    }
    const name = value.trim();
    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new BadRequestException(`El nombre debe tener entre ${MIN_NAME_LENGTH} y ${MAX_NAME_LENGTH} caracteres.`);
    }
    return name;
  }

  private validatePhone(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('El teléfono debe ser texto.');
    }
    const phone = value.trim();
    const digitCount = phone.replace(/\D/g, '').length;
    if (
      !phone ||
      phone.length > MAX_PHONE_LENGTH ||
      digitCount < MIN_PHONE_DIGITS ||
      digitCount > MAX_PHONE_DIGITS ||
      !/^\+?[0-9\s().-]+$/.test(phone)
    ) {
      throw new BadRequestException('El teléfono no tiene un formato válido.');
    }
    return phone;
  }

  private loginPhone(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const phone = value.trim();
    return phone && phone.length <= MAX_PHONE_LENGTH ? phone : null;
  }

  private optionalString(value: unknown, field: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(`El campo ${field} debe ser texto.`);
    }
    return value.trim() || null;
  }

  private requireBody(body: unknown, allowInvalid = false): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      if (allowInvalid) return {};
      throw new BadRequestException('Los datos enviados no son válidos.');
    }
    return body as Record<string, unknown>;
  }

  private sanitizeCustomer<T extends Record<string, unknown>>(customer: T): Omit<T, 'password'> {
    const { password: _password, ...sanitized } = customer;
    return sanitized;
  }
}
