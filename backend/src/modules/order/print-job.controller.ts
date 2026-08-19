import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { requireBearerToken } from '../../lib/http.js';
import { StaffAuthService } from '../staff/staff-auth.service.js';
import { OrderService } from './order.service.js';
import { PrintJobService } from './print-job.service.js';

@Controller('printing/jobs')
export class PrintJobController {
  constructor(
    private readonly printJobService: PrintJobService,
    private readonly orderService: OrderService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

  @Post('claim')
  async claim(
    @Headers('Authorization') authHeader: string | undefined,
    @Body('branchId') requestedBranchId: unknown,
    @Body('stationId') stationId: unknown,
    @Body('stationName') stationName: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    const job = await this.printJobService.claimNext(branchId, stationId, stationName);
    if (!job) return { job: null, order: null };
    return { job, order: await this.orderService.getOrder(job.orderId) };
  }

  @Post(':id/start')
  async start(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('branchId') requestedBranchId: unknown,
    @Body('stationId') stationId: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    return this.printJobService.startPrinting(id, branchId, stationId);
  }

  @Post(':id/complete')
  async complete(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('branchId') requestedBranchId: unknown,
    @Body('stationId') stationId: unknown,
    @Body('result') result: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    return this.printJobService.complete(id, branchId, stationId, result);
  }

  @Post(':id/fail')
  async fail(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('branchId') requestedBranchId: unknown,
    @Body('stationId') stationId: unknown,
    @Body('error') error: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    return this.printJobService.fail(id, branchId, stationId, error);
  }

  @Post(':id/retry')
  async retry(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('branchId') requestedBranchId: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    return this.printJobService.retry(id, branchId);
  }

  @Get()
  async list(
    @Headers('Authorization') authHeader: string | undefined,
    @Query('branchId') requestedBranchId: unknown,
    @Query('limit') limit: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const branchId = this.resolveBranchScope(staff, requestedBranchId);
    return this.printJobService.listRecent(branchId, limit);
  }

  private resolveBranchScope(
    staff: { role: StaffRole; branchId: string | null },
    requestedBranchId: unknown,
  ): string {
    const requested = typeof requestedBranchId === 'string' && requestedBranchId ? requestedBranchId : null;
    if (staff.role === StaffRole.ADMIN) {
      if (!requested) throw new ForbiddenException('Selecciona una sucursal para administrar impresión.');
      return requested;
    }
    if (!staff.branchId) throw new ForbiddenException('Tu cuenta no tiene una sucursal asignada.');
    if (requested && requested !== staff.branchId) {
      throw new ForbiddenException('No tienes permiso para administrar impresión de otra sucursal.');
    }
    return staff.branchId;
  }
}
