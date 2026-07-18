import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { AuthService } from '../auth/auth.service.js';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly authService: AuthService,
  ) {}

  @Post('orders')
  async createOrder(@Headers('Authorization') authHeader: string | undefined, @Body() body: any) {
    const token = this.extractToken(authHeader);
    const hasGuestContact = Boolean(
      typeof body?.customerName === 'string' && body.customerName.trim() &&
      typeof body?.customerPhone === 'string' && body.customerPhone.trim()
    );

    if (token) {
      try {
        const customer = await this.authService.validateSession(token);
        return this.orderService.createOrder(customer.id, body);
      } catch {
        if (hasGuestContact) {
          return this.orderService.createOrder(null, body);
        }
        throw new UnauthorizedException('Sesión expirada o inválida. Por favor, inicia sesión de nuevo.');
      }
    }

    return this.orderService.createOrder(null, body);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orderService.getOrder(id);
  }

  @Get('admin/orders')
  async listOrders(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Query('branchId') branchId?: string,
  ) {
    this.assertAdmin(adminKey);
    return this.orderService.listOrders({ branchId });
  }

  @Patch('admin/orders/:id/status')
  async updateOrderStatus(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    this.assertAdmin(adminKey);
    return this.orderService.updateOrderStatus(id, status);
  }

  private extractToken(authHeader?: string): string {
    if (!authHeader) return '';
    const parts = authHeader.split(' ');
    return parts.length === 2 ? parts[1] : parts[0];
  }

  private assertAdmin(adminKey?: string) {
    const expectedKey = process.env.ADMIN_CATALOG_KEY;
    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Clave administrativa inválida.');
    }
  }
}
