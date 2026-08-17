import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { areMenuPromotionsOpen, resolvePromotionWindowHours } from '../../lib/promotion-window.js';
import { isTransitionAllowed } from './order-status.js';

const DELIVERY_TYPES = new Set(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set(['cash', 'card']);
const MAX_ITEM_QTY = 20;
const MAX_ITEMS_PER_ORDER = 40;
const MAX_NOTES_LENGTH = 500;
const MAX_EXTRA_NAME_LENGTH = 80;
const MAX_EXTRAS_PER_ITEM = 10;
const MAX_REMOVALS_PER_ITEM = 10;
const MAX_REMOVAL_LENGTH = 80;
const TRACKING_ORDER_SELECT = {
  id: true,
  folio: true,
  customerId: true,
  branchId: true,
  branchName: true,
  status: true,
  rejectionReason: true,
  total: true,
  deliveryType: true,
  paymentMethod: true,
  createdAt: true,
  items: {
    select: {
      productName: true,
      quantity: true,
    },
  },
} as const;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(customerId: string, body: any) {
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

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
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
        if (customer.points < requestedPoints) {
          throw new BadRequestException('Puntos insuficientes.');
        }
        // 1 point = $1 discount, and a customer can never redeem more than the order subtotal.
        pointsRedeemed = Math.min(requestedPoints, Math.floor(calculatedTotal));
        calculatedTotal = Math.max(0, calculatedTotal - pointsRedeemed);
      }
    }

    const pointsEarned = Math.floor(calculatedTotal / 10);

    // Save order
    const order = await this.prisma.$transaction(async (tx) => {
      const folio = await this.generateFolio(tx);

      const newOrder = await tx.order.create({
        data: {
          id: randomUUID(),
          folio,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          branchId: branch.id,
          branchName: branch.name,
          status: OrderStatus.PENDING_APPROVAL,
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

      // Immutable audit trail starts here, in the same transaction as the
      // order itself (TREINTA Y CUATRO) — Order and its history can never
      // diverge. No staff is responsible for the order existing; the actor
      // is the customer.
      await tx.orderStatusHistory.create({
        data: {
          id: randomUUID(),
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING_APPROVAL,
          staffId: null,
          reason: 'Pedido creado por el cliente.',
        },
      });

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

  // Generates a human-facing folio (FB-000123) from a dedicated PostgreSQL
  // sequence. nextval() is atomic under concurrency, so two simultaneous
  // orders can never collide — unlike a naive count()+1 approach.
  private async generateFolio(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_folio_seq') AS nextval`;
    const value = rows[0]?.nextval ?? 0n;
    return `FB-${value.toString().padStart(6, '0')}`;
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: TRACKING_ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    return {
      ...order,
      total: Number(order.total),
    };
  }

  // Immutable trail (OCHO). Ownership/branch authorization is checked by the
  // caller (OrderController) before this is reached.
  async getOrderHistory(orderId: string) {
    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: { staff: { select: { id: true, name: true } } },
    });
  }

  async listCustomerOrders(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      select: TRACKING_ORDER_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => ({
      ...order,
      total: Number(order.total),
    }));
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

  /**
   * The only way an order's status is ever allowed to change. Runs the whole
   * check-transition + update + history-write as one atomic operation:
   *
   * - Validates the transition against the state machine (order-status.ts).
   * - Uses an optimistic lock (`updateMany` scoped to the status we just
   *   read) so that two concurrent transitions can never both "win" — the
   *   loser gets 0 affected rows and a 409, exactly like DIECIOCHO/TREINTA Y
   *   NUEVE in nuevo modulo.md require.
   * - Writes an immutable OrderStatusHistory row in the same transaction, so
   *   Order.status and its history can never diverge (TREINTA Y CUATRO).
   *
   * Authorization (who is allowed to request `to` for this order/branch) is
   * the caller's responsibility — see Fase 3/5.
   */
  async transitionOrder(
    orderId: string,
    to: OrderStatus,
    opts: { staffId?: string | null; reason?: string | null; metadata?: Prisma.InputJsonValue } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!current) {
        throw new NotFoundException('Pedido no encontrado.');
      }

      if (!isTransitionAllowed(current.status, to)) {
        throw new BadRequestException(`No se puede pasar de "${current.status}" a "${to}".`);
      }

      const reason = opts.reason?.trim() || null;

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: current.status },
        data: {
          status: to,
          ...(to === OrderStatus.REJECTED ? { rejectionReason: reason } : {}),
        },
      });

      if (updated.count === 0) {
        // Someone else changed this order between our read and our write.
        throw new ConflictException('El pedido ya fue actualizado por otra operación. Vuelve a consultarlo.');
      }

      await tx.orderStatusHistory.create({
        data: {
          id: randomUUID(),
          orderId,
          fromStatus: current.status,
          toStatus: to,
          staffId: opts.staffId ?? null,
          reason,
          metadata: opts.metadata,
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      return {
        ...order,
        total: Number(order.total),
        items: order.items.map((i) => ({ ...i, price: Number(i.price) })),
      };
    });
  }

  // TEMPORARY: kept only so the pre-existing PATCH /admin/orders/:id/status
  // route still compiles/works during the migration. It will be replaced in
  // Fase 5 (API operativa) by the dedicated accept/reject/status endpoints.
  // Authorization (staff session + branch scoping) is now enforced by
  // OrderController (Fase 3) before this is called.
  async updateOrderStatus(id: string, status: string, staffId?: string) {
    if (!this.isOrderStatus(status)) {
      throw new BadRequestException('Estado inválido.');
    }

    return this.transitionOrder(id, status, { staffId });
  }

  private isOrderStatus(value: string): value is OrderStatus {
    return (Object.values(OrderStatus) as string[]).includes(value);
  }
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
