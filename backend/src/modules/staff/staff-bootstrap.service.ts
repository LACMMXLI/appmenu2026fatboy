import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Creates the first Staff/ADMIN account from environment variables when the
 * `staff` table is empty. Without this there would be no way to log in and
 * create further staff accounts short of a manual DB insert. Idempotent and
 * a no-op once at least one staff account exists or the env vars are unset.
 */
@Injectable()
export class StaffBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(StaffBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async onModuleInit() {
    const username = process.env.STAFF_BOOTSTRAP_USERNAME?.trim().toLowerCase();
    const password = process.env.STAFF_BOOTSTRAP_PASSWORD;
    const name = process.env.STAFF_BOOTSTRAP_NAME?.trim() || 'Administrador';

    if (!username || !password) return;

    const existingAny = await this.prisma.staff.count();
    if (existingAny > 0) return;

    const hashedPassword = await this.authService.hashPassword(password);
    await this.prisma.staff.create({
      data: {
        id: randomUUID(),
        name,
        username,
        password: hashedPassword,
        role: StaffRole.ADMIN,
        branchId: null,
        active: true,
      },
    });

    this.logger.log(`Cuenta de personal inicial creada: ${username} (ADMIN).`);
  }
}
