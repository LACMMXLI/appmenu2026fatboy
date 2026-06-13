import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, hash] = storedHash.split(':');
    const checkHash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  }

  async register(body: any) {
    const { name, phone, password, favoriteBranchId } = body;

    if (!name || !phone || !password) {
      throw new ConflictException('Faltan datos requeridos (nombre, teléfono o contraseña).');
    }

    const existing = await this.prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('Este número de teléfono ya está registrado.');
    }

    const hashedPassword = this.hashPassword(password);
    const customer = await this.prisma.customer.create({
      data: {
        id: randomUUID(),
        name,
        phone,
        password: hashedPassword,
        favoriteBranchId: favoriteBranchId || null,
        points: 0,
      },
    });

    const session = await this.createSession(customer.id);
    return { token: session.id, customer: this.sanitizeCustomer(customer) };
  }

  async login(body: any) {
    const { phone, password } = body;

    if (!phone || !password) {
      throw new UnauthorizedException('Falta teléfono o contraseña.');
    }

    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer || !this.verifyPassword(password, customer.password)) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos.');
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

  async updateProfile(customerId: string, body: any) {
    const { name, phone, favoriteBranchId } = body;

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

  async changePassword(customerId: string, body: any) {
    const { oldPassword, newPassword } = body;

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !this.verifyPassword(oldPassword, customer.password)) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        password: this.hashPassword(newPassword),
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

  private sanitizeCustomer(customer: any) {
    const { password, ...sanitized } = customer;
    return sanitized;
  }
}
