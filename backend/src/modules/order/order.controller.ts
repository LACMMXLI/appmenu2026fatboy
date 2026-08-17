import { Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { OrderService } from './order.service.js';
import { AuthService } from '../auth/auth.service.js';
import { StaffAuthService } from '../staff/staff-auth.service.js';
import { extractBearerToken, requireBearerToken } from '../../lib/http.js';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly authService: AuthService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

  @Post('orders')
  async createOrder(@Headers('Authorization') authHeader: string | undefined, @Body() body: any) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión o crear una cuenta para realizar un pedido.');
    }

    const customer = await this.authService.validateSession(token);
    return this.orderService.createOrder(customer.id, body);
  }

  @Get('orders/mine')
  async listCustomerOrders(@Headers('Authorization') authHeader: string | undefined) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión para consultar tu historial de compras.');
    }

    const customer = await this.authService.validateSession(token);
    return this.orderService.listCustomerOrders(customer.id);
  }

  // Knowing a pedido's id/folio is NOT authorization (DOCE). The requester
  // must be either the customer who owns the order, or staff assigned to the
  // branch that received it (or an ADMIN). Anything else gets a 404 — never
  // a 403/401 that would confirm the order exists.
  @Get('orders/:id')
  async getOrder(@Param('id') id: string, @Headers('Authorization') authHeader?: string) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión para consultar este pedido.');
    }

    const order = await this.orderService.getOrder(id);

    const customer = await this.authService.validateSession(token).catch(() => null);
    if (customer && order.customerId === customer.id) {
      return order;
    }

    const staff = await this.staffAuthService.tryValidateSession(token);
    if (staff && (staff.role === StaffRole.ADMIN || staff.branchId === order.branchId)) {
      return order;
    }

    throw new NotFoundException('Pedido no encontrado.');
  }

  @Get('orders/:id/history')
  async getOrderHistory(@Param('id') id: string, @Headers('Authorization') authHeader?: string) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión para consultar este pedido.');
    }

    const order = await this.orderService.getOrder(id);

    const customer = await this.authService.validateSession(token).catch(() => null);
    const staff = customer ? null : await this.staffAuthService.tryValidateSession(token);
    const isOwner = customer && order.customerId === customer.id;
    const isBranchStaff = staff && (staff.role === StaffRole.ADMIN || staff.branchId === order.branchId);

    if (!isOwner && !isBranchStaff) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    return this.orderService.getOrderHistory(id);
  }

  @Get('admin/orders')
  async listOrders(@Headers('Authorization') authHeader: string | undefined, @Query('branchId') branchId?: string) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const scopedBranchId = this.resolveBranchScope(staff, branchId);
    return this.orderService.listOrders({ branchId: scopedBranchId });
  }

  @Patch('admin/orders/:id/status')
  async updateOrderStatus(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);
    return this.orderService.updateOrderStatus(id, status, staff.id);
  }

  /** Non-ADMIN staff are locked to their own branch; ADMIN can pass any/none. */
  private resolveBranchScope(
    staff: { role: StaffRole; branchId: string | null },
    requestedBranchId?: string,
  ): string | undefined {
    if (staff.role === StaffRole.ADMIN) {
      return requestedBranchId;
    }
    if (!staff.branchId) {
      throw new ForbiddenException('Tu cuenta no tiene una sucursal asignada.');
    }
    if (requestedBranchId && requestedBranchId !== staff.branchId) {
      throw new ForbiddenException('No tienes permiso para consultar pedidos de otra sucursal.');
    }
    return staff.branchId;
  }

  private assertBranchAccess(staff: { role: StaffRole; branchId: string | null }, orderBranchId: string): void {
    if (staff.role === StaffRole.ADMIN) return;
    if (staff.branchId !== orderBranchId) {
      throw new ForbiddenException('No tienes permiso para administrar pedidos de otra sucursal.');
    }
  }
}
