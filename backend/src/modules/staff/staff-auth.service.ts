import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    // Same reasoning as AuthService.validateSession: a malformed id would
    // otherwise make Prisma throw a validation error, surfacing as a 500
    // instead of 401.
    if (!token || !UUID_PATTERN.test(token)) {
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
    const requestedBranchId = typeof input.branchId === 'string' && input.branchId ? input.branchId : null;
    const branchId = role === StaffRole.ADMIN ? null : requestedBranchId;

    if (role !== StaffRole.ADMIN && !branchId) {
      throw new BadRequestException('Los usuarios de sucursal deben tener una sucursal asignada.');
    }

    if (branchId) {
      if (!UUID_PATTERN.test(branchId)) {
        throw new BadRequestException('La sucursal seleccionada no es válida.');
      }
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new BadRequestException('La sucursal seleccionada no existe en el catálogo.');
      }
    }

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

  async listStaff() {
    const staff = await this.prisma.staff.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    return staff.map((member) => this.sanitize(member));
  }

  async changePassword(token: string, body: unknown) {
    const currentStaff = await this.validateSession(token);
    const input = this.requireBody(body);
    const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
    const newPassword = this.validatePassword(input.newPassword);

    const storedStaff = await this.prisma.staff.findUnique({ where: { id: currentStaff.id } });
    if (!storedStaff || !(await this.authService.verifyPassword(currentPassword, storedStaff.password))) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente.');
    }

    const password = await this.authService.hashPassword(newPassword);
    await this.prisma.staff.update({ where: { id: currentStaff.id }, data: { password } });
    await this.prisma.staffSession.deleteMany({
      where: { staffId: currentStaff.id, id: { not: token } },
    });

    return { ok: true };
  }

  async updateStaff(id: string, body: unknown) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('El usuario seleccionado no es válido.');
    }

    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El usuario no existe.');

    const input = this.requireBody(body);
    const data: {
      name?: string;
      role?: StaffRole;
      branchId?: string | null;
      active?: boolean;
    } = {};

    if (Object.prototype.hasOwnProperty.call(input, 'name')) data.name = this.validateName(input.name);
    if (Object.prototype.hasOwnProperty.call(input, 'active')) {
      if (typeof input.active !== 'boolean') throw new BadRequestException('El estado del usuario no es válido.');
      data.active = input.active;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'role')) data.role = this.validateRole(input.role);
    if (Object.prototype.hasOwnProperty.call(input, 'branchId')) {
      const branchId = typeof input.branchId === 'string' && input.branchId ? input.branchId : null;
      if (branchId && (!UUID_PATTERN.test(branchId) || !(await this.prisma.branch.findUnique({ where: { id: branchId } })))) {
        throw new BadRequestException('La sucursal seleccionada no existe en el catálogo.');
      }
      data.branchId = branchId;
    }

    const nextRole = data.role ?? existing.role;
    const nextBranchId = data.branchId === undefined ? existing.branchId : data.branchId;
    const nextActive = data.active === undefined ? existing.active : data.active;
    if (existing.role === StaffRole.ADMIN && (nextRole !== StaffRole.ADMIN || !nextActive)) {
      const activeAdmins = await this.prisma.staff.count({ where: { role: StaffRole.ADMIN, active: true } });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Debe permanecer al menos un administrador activo.');
      }
    }
    if (nextRole === StaffRole.ADMIN) {
      data.branchId = null;
    } else if (!nextBranchId) {
      throw new BadRequestException('Los usuarios de sucursal deben tener una sucursal asignada.');
    }

    if (!Object.keys(data).length) throw new BadRequestException('No hay cambios para guardar.');
    const updated = await this.prisma.staff.update({ where: { id }, data });
    return this.sanitize(updated);
  }

  async resetPassword(id: string, body: unknown, currentToken?: string) {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException('El usuario seleccionado no es válido.');
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('El usuario no existe.');

    const input = this.requireBody(body);
    const password = await this.authService.hashPassword(this.validatePassword(input.password));
    const updated = await this.prisma.staff.update({ where: { id }, data: { password } });
    await this.prisma.staffSession.deleteMany({
      where: { staffId: id, ...(currentToken ? { id: { not: currentToken } } : {}) },
    });
    return this.sanitize(updated);
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
