import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { requireBearerToken } from '../../lib/http.js';
import { StaffAuthService } from '../staff/staff-auth.service.js';
import { DeliveryService } from './delivery.service.js';

@Controller()
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

  @Get('deliveries/drivers')
  async listDrivers(@Headers('Authorization') authHeader?: string, @Query('branchId') branchId?: string) {
    const staff = await this.requireDispatcher(authHeader);
    return this.deliveryService.listDrivers(this.resolveBranchId(staff, branchId));
  }

  @Get('deliveries/mine')
  async mine(@Headers('Authorization') authHeader?: string) {
    const staff = await this.requireDriver(authHeader);
    return this.deliveryService.listMine(staff.id);
  }

  @Post('orders/:orderId/delivery/assign')
  async assign(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('orderId') orderId: string,
    @Body('driverId') driverId?: string,
  ) {
    const staff = await this.requireDispatcher(authHeader);
    if (!driverId) throw new BadRequestException('Selecciona un repartidor.');
    return this.deliveryService.assign(orderId, driverId, staff);
  }

  @Post('deliveries/:id/start')
  async start(@Headers('Authorization') authHeader: string | undefined, @Param('id') id: string) {
    const staff = await this.requireDriver(authHeader);
    return this.deliveryService.start(id, staff.id);
  }

  @Post('deliveries/:id/incident')
  async incident(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const staff = await this.requireDriver(authHeader);
    return this.deliveryService.reportIncident(id, staff.id, reason ?? '');
  }

  @Post('deliveries/:id/complete')
  async complete(@Headers('Authorization') authHeader: string | undefined, @Param('id') id: string) {
    const staff = await this.requireDriver(authHeader);
    return this.deliveryService.complete(id, staff.id);
  }

  private async requireDispatcher(authHeader?: string) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    if (staff.role === StaffRole.DRIVER) throw new ForbiddenException('Los repartidores no pueden asignar pedidos.');
    return staff;
  }

  private async requireDriver(authHeader?: string) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    if (staff.role !== StaffRole.DRIVER) throw new ForbiddenException('Esta acción es exclusiva del repartidor asignado.');
    return staff;
  }

  private resolveBranchId(staff: { role: StaffRole; branchId: string | null }, requested?: string) {
    if (staff.role === StaffRole.ADMIN) {
      if (!requested) throw new BadRequestException('Selecciona una sucursal.');
      return requested;
    }
    if (!staff.branchId) throw new ForbiddenException('Tu cuenta no tiene una sucursal asignada.');
    if (requested && requested !== staff.branchId) throw new ForbiddenException('No tienes permiso para otra sucursal.');
    return staff.branchId;
  }
}
