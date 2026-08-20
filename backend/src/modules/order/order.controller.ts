import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, NotFoundException, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { OrderStatus, StaffRole } from '@prisma/client';
import { OrderService } from './order.service.js';
import { AuthService } from '../auth/auth.service.js';
import { StaffAuthService } from '../staff/staff-auth.service.js';
import { extractBearerToken, requireBearerToken } from '../../lib/http.js';
import { isOrderStatusValue } from './order-status.js';

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
  async listCustomerOrders(
    @Headers('Authorization') authHeader: string | undefined,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión para consultar tu historial de compras.');
    }

    const customer = await this.authService.validateSession(token);
    return this.orderService.listCustomerOrders(customer.id, { limit: Number(limit), cursor });
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

  // Read-only. Branch operators use their own Staff session (branch-scoped).
  // The master admin key — already trusted with full visibility over
  // catalog/customers/redemptions in AdminCatalogView — may also browse
  // orders across all branches for administrative search (VEINTISÉIS). It
  // grants no write access: accept/reject/status stay Staff-session-only, so
  // every status change is still attributed to a real person.
  @Get('admin/orders')
  async listOrders(
    @Headers('Authorization') authHeader: string | undefined,
    @Headers('x-admin-key') adminKey: string | undefined,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('q') query?: string,
    @Query('status') status?: string,
  ) {
    let scopedBranchId = branchId;
    if (!adminKey || !this.isValidAdminKey(adminKey)) {
      const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
      scopedBranchId = this.resolveBranchScope(staff, branchId);
    }
    return this.orderService.listOrders({
      branchId: scopedBranchId,
      limit: Number(limit),
      cursor,
      query,
      statuses: this.parseStatusFilter(status),
    });
  }

  @Delete('admin/orders')
  async deleteAllOrders(
    @Headers('Authorization') authHeader: string | undefined,
    @Body('confirmation') confirmation: unknown,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    if (staff.role !== StaffRole.ADMIN) {
      throw new ForbiddenException('Solo un administrador puede eliminar todos los pedidos.');
    }
    if (confirmation !== 'ELIMINAR TODOS LOS PEDIDOS') {
      throw new BadRequestException('Escribe la frase de confirmación completa para eliminar los pedidos.');
    }
    return this.orderService.deleteAllOrders();
  }

  // Comma-separated list of OrderStatus, silently dropping anything invalid
  // rather than 400ing — a stale/typo'd filter should just show nothing
  // extra, never break Historial.
  private parseStatusFilter(value?: string): OrderStatus[] | undefined {
    if (!value) return undefined;
    const statuses = value
      .split(',')
      .map((s) => s.trim())
      .filter(isOrderStatusValue);
    return statuses.length ? statuses : undefined;
  }

  // PENDING_APPROVAL → ACCEPTED. Only staff of the receiving branch (or ADMIN).
  @Post('orders/:id/accept')
  async acceptOrder(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);
    return this.orderService.transitionOrder(id, OrderStatus.ACCEPTED, { staffId: staff.id });
  }

  // PENDING_APPROVAL → REJECTED. A reason is mandatory (SEIS).
  @Post('orders/:id/reject')
  async rejectOrder(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Debes indicar un motivo de rechazo.');
    }

    return this.orderService.transitionOrder(id, OrderStatus.REJECTED, { staffId: staff.id, reason });
  }

  // The rest of the machine (ACCEPTED→PREPARING→READY→COMPLETED, or
  // →CANCELLED). Accept/reject have their own endpoints above because they
  // carry different validation (reason requirement) — kept separate rather
  // than overloading this one (no endpoints redundantes, but no god-endpoint
  // either).
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason?: string,
  ) {
    if (!isOrderStatusValue(status) || status === OrderStatus.ACCEPTED || status === OrderStatus.REJECTED) {
      throw new BadRequestException('Estado inválido. Usa /accept o /reject para esos cambios.');
    }

    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);
    return this.orderService.transitionOrder(id, status, { staffId: staff.id, reason });
  }

  // Customer-initiated. PENDING_APPROVAL cancels immediately (branch hasn't
  // acted yet); ACCEPTED/PREPARING only *requests* cancellation — the branch
  // decides below, since by then preparation may already be underway.
  @Post('orders/:id/cancel')
  async cancelOrder(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const token = extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión para cancelar este pedido.');
    }
    const customer = await this.authService.validateSession(token);
    return this.orderService.cancelOrder(id, customer.id, reason);
  }

  // Branch approves the customer's cancellation request → CANCELLED.
  @Post('orders/:id/cancellation/approve')
  async approveCancellation(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);
    return this.orderService.resolveCancellationRequest(id, staff.id, true, note);
  }

  // Branch rejects the customer's cancellation request — order keeps going
  // (e.g. "ya está en preparación, no se puede cancelar").
  @Post('orders/:id/cancellation/reject')
  async rejectCancellation(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    const staff = await this.staffAuthService.validateSession(requireBearerToken(authHeader));
    const order = await this.orderService.getOrder(id);
    this.assertBranchAccess(staff, order.branchId);
    return this.orderService.resolveCancellationRequest(id, staff.id, false, note);
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

  private isValidAdminKey(adminKey: string): boolean {
    const expectedKey = process.env.ADMIN_CATALOG_KEY;
    return Boolean(expectedKey) && adminKey === expectedKey;
  }
}
