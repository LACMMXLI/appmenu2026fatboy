import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(customerId: string | null, body: any) {
    const { branchId, deliveryType, paymentMethod, notes, items, pointsToRedeem } = body;

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada.');
    }

    const customer = customerId ? await this.prisma.customer.findUnique({ where: { id: customerId } }) : null;
    if (customerId && !customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const guestName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const guestPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
    if (!customer && (!guestName || !guestPhone)) {
      throw new BadRequestException('Nombre y teléfono son obligatorios para pedidos invitados.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('El pedido debe incluir al menos un producto.');
    }

    // Fetch products to validate price
    const productIds = items.map((i: any) => i.id);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedTotal = 0;
    const orderItemsData: any[] = [];

    for (const item of items) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct || dbProduct.status !== 'active') {
        throw new BadRequestException(`El producto ${item.title || 'desconocido'} no está activo.`);
      }

      let itemPrice = Number(dbProduct.price);
      // Add extras price
      if (item.extras && Array.isArray(item.extras)) {
        for (const extra of item.extras) {
          itemPrice += Number(extra.price || 0);
        }
      }

      const qty = Number(item.qty || 1);
      calculatedTotal += itemPrice * qty;

      orderItemsData.push({
        id: randomUUID(),
        productId: dbProduct.id,
        productName: dbProduct.name,
        price: itemPrice,
        quantity: qty,
        meatPrep: item.meatPrep || null,
        extras: item.extras ? JSON.stringify(item.extras) : null,
        removals: item.removals ? JSON.stringify(item.removals) : null,
      });
    }

    let pointsRedeemed = 0;
    if (customer && pointsToRedeem && pointsToRedeem > 0) {
      if (customer.points < pointsToRedeem) {
        throw new BadRequestException('Puntos insuficientes.');
      }
      pointsRedeemed = pointsToRedeem;
      // In this system: 1 point = $1 discount
      const discount = pointsRedeemed;
      calculatedTotal = Math.max(0, calculatedTotal - discount);
    }

    const pointsEarned = customer ? Math.floor(calculatedTotal / 10) : 0;

    // Save order
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          id: randomUUID(),
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? guestName,
          customerPhone: customer?.phone ?? guestPhone,
          branchId: branch.id,
          branchName: branch.name,
          status: 'pending',
          total: calculatedTotal,
          pointsEarned,
          pointsRedeemed,
          deliveryType: deliveryType || 'pickup',
          paymentMethod: paymentMethod || 'cash',
          notes: notes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            points: {
              decrement: pointsRedeemed,
              increment: pointsEarned,
            },
          },
        });
      }

      return newOrder;
    });

    return {
      ...order,
      total: Number(order.total),
      items: order.items.map((i) => ({
        ...i,
        price: Number(i.price),
      })),
    };
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    return {
      ...order,
      total: Number(order.total),
      items: order.items.map((i) => ({
        ...i,
        price: Number(i.price),
      })),
    };
  }

  async listOrders(filters: { branchId?: string }) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
      ...order,
      total: Number(order.total),
      items: order.items.map((i) => ({
        ...i,
        price: Number(i.price),
      })),
    }));
  }

  async updateOrderStatus(id: string, status: string) {
    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Estado inválido.');
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    return order;
  }
}
