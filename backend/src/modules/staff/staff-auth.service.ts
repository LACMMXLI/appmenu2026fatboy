import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

const MAX_USERNAME_LENGTH = 60;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
// One operating shift/day — long enough that staff aren't logged out mid-service,
// short enough that a lost/shared tablet session doesn't stay valid indefinitely.
const SESSION_HOURS = 14;

/**
 * Authenticates internal staff (branch operators) as real, individually
 * identifiable accounts — replacing the shared ADMIN_CATALOG_KEY for order
 * management. Reuses AuthService's password hashing so there is exactly one
 * hashing strategy (Argon2id) in the codebase (TREINTA Y SEIS / no duplicar).
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async login(body: unknown) {
    const input = this.requireBody(body);
    const username = this.normalizeUsername(input.username);
    const password = typeof input.password === 'string' ? input.password : '';

    if (!username || !password) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }

    const staff = await this.prisma.staff.findUnique({ where: { username } });
    if (!staff || !staff.active || !(await this.authService.verifyPassword(password, staff.password))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }

    const session = await this.prisma.staffSession.create({
      data: { id: randomUUID(), staffId: staff.id, expiresAt: this.sessionExpiry() },
    });

    return { token: session.id, staff: this.sanitize(staff) };
  }

  async logout(token: string) {
    await this.prisma.staffSession.deleteMany({ where: { id: token } });
    return { ok: true };
  }

  /** Resolves a bearer token to the active Staff it belongs to, or throws. */
  async validateSession(token: string) {
    if (!token) {
      throw new UnauthorizedException('Sesión de personal inválida.');
    }

    const session = await this.prisma.staffSession.findUnique({
      where: { id: token },
      include: { staff: true },
    });

    if (!session || session.expiresAt < new Date() || !session.staff.active) {
      if (session) {
        await this.prisma.staffSession.delete({ where: { id: token } }).catch(() => undefined);
      }
      throw new UnauthorizedException('Sesión de personal inválida o expirada.');
    }

    return this.sanitize(session.staff);
  }

  /** Same-shape validation, but never throws — used where staff auth is optional (e.g. GET /orders/:id). */
  async tryValidateSession(token: string) {
    try {
      return await this.validateSession(token);
    } catch {
      return null;
    }
  }

  async createStaff(body: unknown) {
    const input = this.requireBody(body);
    const name = this.validateName(input.name);
    const username = this.normalizeUsername(input.username);
    if (!username) {
      throw new BadRequestException('El usuario es obligatorio.');
    }
    const password = this.validatePassword(input.password);
    const role = this.validateRole(input.role);
    const branchId = typeof input.branchId === 'string' && input.branchId ? input.branchId : null;

    const existing = await this.prisma.staff.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException('Ese usuario ya existe.');
    }

    const hashedPassword = await this.authService.hashPassword(password);
    const staff = await this.prisma.staff.create({
      data: { id: randomUUID(), name, username, password: hashedPassword, role, branchId, active: true },
    });

    return this.sanitize(staff);
  }

  private sessionExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_HOURS);
    return expiresAt;
  }

  private sanitize<T extends Record<string, unknown>>(staff: T): Omit<T, 'password'> {
    const { password: _password, ...sanitized } = staff;
    return sanitized;
  }

  private requireBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Los datos enviados no son válidos.');
    }
    return body as Record<string, unknown>;
  }

  private normalizeUsername(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().slice(0, MAX_USERNAME_LENGTH);
  }

  private validateName(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres.');
    }
    return value.trim().slice(0, 100);
  }

  private validatePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`,
      );
    }
    return value;
  }

  private validateRole(value: unknown): StaffRole {
    const roles = Object.values(StaffRole) as string[];
    if (typeof value === 'string' && roles.includes(value)) {
      return value as StaffRole;
    }
    return StaffRole.STAFF;
  }
}
