import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { areMenuPromotionsOpen, resolvePromotionWindowHours } from '../../lib/promotion-window.js';

const DELIVERY_TYPES = new Set(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set(['cash', 'card']);
const MAX_ITEM_QTY = 20;
const MAX_ITEMS_PER_ORDER = 40;
const MAX_NOTES_LENGTH = 500;
const MAX_EXTRA_NAME_LENGTH = 80;
const MAX_EXTRAS_PER_ITEM = 10;
const MAX_REMOVALS_PER_ITEM = 10;
const MAX_REMOVAL_LENGTH = 80;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(customerId: string | null, body: any) {
    const { branchId, notes, items, pointsToRedeem } = body;

    const deliveryType = typeof body.deliveryType === 'string' ? body.deliveryType : 'pickup';
    if (!DELIVERY_TYPES.has(deliveryType)) {
      throw new BadRequestException('Tipo de entrega inválido.');
    }

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : 'cash';
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      throw new BadRequestException('Método de pago inválido.');
    }

    if (typeof branchId !== 'string' || !branchId) {
      throw new BadRequestException('Sucursal inválida.');
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada.');
    }

    const customer = customerId ? await this.prisma.customer.findUnique({ where: { id: customerId } }) : null;
    if (customerId && !customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const guestName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 120) : '';
    const guestPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 30) : '';
    if (!customer && (!guestName || !guestPhone)) {
      throw new BadRequestException('Nombre y teléfono son obligatorios para pedidos invitados.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('El pedido debe incluir al menos un producto.');
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
      throw new BadRequestException('El pedido tiene demasiados productos.');
    }

    const notesValue =
      typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, MAX_NOTES_LENGTH) : null;

    // Fetch products to validate price. Product identity, price and status
    // always come from the database — nothing from the client body is trusted.
    const productIds = items.map((i: any) => (typeof i?.id === 'string' ? i.id : null)).filter(Boolean);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedTotal = 0;
    const orderItemsData: any[] = [];
    const { startHour, endHour } = await resolvePromotionWindowHours(this.prisma);
    const promotionsOpen = areMenuPromotionsOpen(new Date(), startHour, endHour);

    for (const item of items) {
      if (typeof item?.id !== 'string' || !item.id) {
        throw new BadRequestException('Producto inválido en el pedido.');
      }

      const dbProduct = productMap.get(item.id);
      if (!dbProduct || dbProduct.status !== 'active') {
        throw new BadRequestException(`El producto ${item.title || 'desconocido'} no está activo.`);
      }

      if (dbProduct.isPromotion && !promotionsOpen) {
        throw new BadRequestException(
          `Las promociones solo están disponibles de ${formatHour(startHour)} a ${formatHour(endHour)} h.`,
        );
      }

      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_QTY) {
        throw new BadRequestException('Cantidad inválida en el pedido.');
      }

      // Extras/removals are cosmetic notes for the kitchen only. There is no
      // backend catalog of paid extras yet, so client-supplied prices are
      // never trusted — only the product's own DB price counts toward the total.
      let extrasForStorage: { name: string }[] | null = null;
      if (item.extras !== undefined && item.extras !== null) {
        if (!Array.isArray(item.extras) || item.extras.length > MAX_EXTRAS_PER_ITEM) {
          throw new BadRequestException('Extras inválidos en el pedido.');
        }
        extrasForStorage = item.extras.map((extra: any) => {
          if (typeof extra?.name !== 'string' || !extra.name.trim()) {
            throw new BadRequestException('Extras inválidos en el pedido.');
          }
          return { name: extra.name.trim().slice(0, MAX_EXTRA_NAME_LENGTH) };
        });
      }

      let removalsForStorage: string[] | null = null;
      if (item.removals !== undefined && item.removals !== null) {
        if (!Array.isArray(item.removals) || item.removals.length > MAX_REMOVALS_PER_ITEM) {
          throw new BadRequestException('Ingredientes a quitar inválidos.');
        }
        removalsForStorage = item.removals.map((removal: any) => {
          if (typeof removal !== 'string' || !removal.trim()) {
            throw new BadRequestException('Ingredientes a quitar inválidos.');
          }
          return removal.trim().slice(0, MAX_REMOVAL_LENGTH);
        });
      }

      const meatPrep =
        typeof item.meatPrep === 'string' && item.meatPrep.trim() ? item.meatPrep.trim().slice(0, 60) : null;

      const itemPrice = Number(dbProduct.price);
      calculatedTotal += itemPrice * qty;

      orderItemsData.push({
        id: randomUUID(),
        productId: dbProduct.id,
        productName: dbProduct.name,
        price: itemPrice,
        quantity: qty,
        meatPrep,
        extras: extrasForStorage ? JSON.stringify(extrasForStorage) : null,
        removals: removalsForStorage ? JSON.stringify(removalsForStorage) : null,
      });
    }

    if (!Number.isFinite(calculatedTotal) || calculatedTotal < 0) {
      throw new BadRequestException('Total de pedido inválido.');
    }

    let pointsRedeemed = 0;
    if (pointsToRedeem !== undefined && pointsToRedeem !== null) {
      const requestedPoints = Number(pointsToRedeem);
      if (!Number.isInteger(requestedPoints) || requestedPoints < 0) {
        throw new BadRequestException('Puntos a redimir inválidos.');
      }
      if (requestedPoints > 0) {
        if (!customer) {
          throw new BadRequestException('Debes iniciar sesión para redimir puntos.');
        }
        if (customer.points < requestedPoints) {
          throw new BadRequestException('Puntos insuficientes.');
        }
        // 1 point = $1 discount, and a customer can never redeem more than the order subtotal.
        pointsRedeemed = Math.min(requestedPoints, Math.floor(calculatedTotal));
        calculatedTotal = Math.max(0, calculatedTotal - pointsRedeemed);
      }
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
          deliveryType,
          paymentMethod,
          notes: notesValue,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      if (customer) {
        if (pointsRedeemed > 0) {
          // Atomic, race-safe deduction: only succeeds if the balance still
          // covers the redemption at commit time, even under concurrent orders.
          const deduction = await tx.customer.updateMany({
            where: { id: customer.id, points: { gte: pointsRedeemed } },
            data: { points: { decrement: pointsRedeemed } },
          });
          if (deduction.count === 0) {
            throw new BadRequestException('Puntos insuficientes.');
          }
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            points: {
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

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
