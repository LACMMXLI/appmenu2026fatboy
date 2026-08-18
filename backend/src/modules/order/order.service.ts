import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { areMenuPromotionsOpen, resolvePromotionWindowHours } from '../../lib/promotion-window.js';
import { isTransitionAllowed } from './order-status.js';
import { OrdersGateway } from './orders.gateway.js';

const DELIVERY_TYPES = new Set(['pickup', 'delivery']);
const PAYMENT_METHODS = new Set(['cash', 'card']);
const MAX_ITEM_QTY = 20;
const MAX_ITEMS_PER_ORDER = 40;
const MAX_NOTES_LENGTH = 500;
const MAX_EXTRA_NAME_LENGTH = 80;
const MAX_EXTRAS_PER_ITEM = 10;
const MAX_REMOVALS_PER_ITEM = 10;
const MAX_REMOVAL_LENGTH = 80;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
// The operational board (BranchOrdersView) lists a small, mostly-active set
// per branch — it can afford a larger default than paginated history views
// (VEINTINUEVE) without needing a cursor for day-to-day use.
const DEFAULT_BOARD_LIMIT = 200;

function clampLimit(limit: number | undefined, fallback: number, max = MAX_PAGE_LIMIT): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
}
const TRACKING_ORDER_SELECT = {
  id: true,
  folio: true,
  customerId: true,
  branchId: true,
  branchName: true,
  status: true,
  rejectionReason: true,
  cancellationRequestedAt: true,
  cancellationRequestReason: true,
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

// Statuses where the customer can still request/trigger a cancellation.
const CANCELLABLE_BY_CUSTOMER = new Set<OrderStatus>([OrderStatus.ACCEPTED, OrderStatus.PREPARING]);

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

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

    // Emitted only after the transaction above has committed (DIECISÉIS) —
    // the branch board should never learn about an order the DB doesn't
    // actually have yet.
    this.ordersGateway.notifyOrderCreated({ id: order.id, branchId: order.branchId });

    return this.serializeOrder(order);
  }

  // Generates a human-facing folio (FB-000123) from a dedicated PostgreSQL
  // sequence. nextval() is atomic under concurrency, so two simultaneous
  // orders can never collide — unlike a naive count()+1 approach.
  private async generateFolio(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_folio_seq') AS nextval`;
    const value = rows[0]?.nextval ?? 0n;
    return `FB-${value.toString().padStart(6, '0')}`;
  }

  // Decimal -> number for the wire, shared by every path that returns a full
  // order with its items (create, transition, cancel, list).
  private serializeOrder<T extends { total: Prisma.Decimal; items: readonly { price: Prisma.Decimal }[] }>(order: T) {
    return {
      ...order,
      total: Number(order.total),
      items: order.items.map((i) => ({ ...i, price: Number(i.price) })),
    };
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

  // Cursor pagination (VEINTINUEVE) — never an unbounded findMany for a
  // collection that only grows. `id` is a stable, unique tie-breaker paired
  // with createdAt so the page order stays deterministic across requests.
  async listCustomerOrders(customerId: string, opts: { limit?: number; cursor?: string } = {}) {
    const limit = clampLimit(opts.limit, DEFAULT_PAGE_LIMIT);
    const rows = await this.prisma.order.findMany({
      where: { customerId },
      select: TRACKING_ORDER_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((order) => ({ ...order, total: Number(order.total) })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async listOrders(filters: { branchId?: string; limit?: number; cursor?: string }) {
    const limit = clampLimit(filters.limit, DEFAULT_BOARD_LIMIT, 500);
    const rows = await this.prisma.order.findMany({
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
      include: { items: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((order) => this.serializeOrder(order)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
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
    const order = await this.prisma.$transaction(async (tx) => {
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
          // Any real status change resolves whatever pending cancellation
          // request existed (approving it *is* this transition to
          // CANCELLED; any other transition makes a stale request moot).
          cancellationRequestedAt: null,
          cancellationRequestReason: null,
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

      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      return this.serializeOrder(updatedOrder);
    });

    // Post-commit only (DIECISÉIS) — clients never learn of a status change
    // Postgres hasn't durably recorded yet.
    this.ordersGateway.notifyOrderStatusChanged({
      id: order.id,
      branchId: order.branchId,
      customerId: order.customerId,
      status: order.status,
    });

    return order;
  }

  /**
   * Customer-initiated cancellation. Ownership is enforced here (returns a
   * 404-worthy NotFoundException for a non-owner, same as GET /orders/:id —
   * DOCE) rather than in the controller, since the right check depends on
   * the order's current owner, not just its id.
   *
   * - PENDING_APPROVAL: cancels immediately — the branch hasn't acted yet,
   *   so no approval is needed.
   * - ACCEPTED/PREPARING: only *requests* cancellation; the branch must
   *   approve or reject it via resolveCancellationRequest.
   * - Anything else: too late to cancel.
   */
  async cancelOrder(orderId: string, customerId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, customerId: true, cancellationRequestedAt: true },
    });
    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (order.status === OrderStatus.PENDING_APPROVAL) {
      return this.transitionOrder(orderId, OrderStatus.CANCELLED, {
        reason: reason?.trim() || 'Cancelado por el cliente antes de ser aceptado.',
      });
    }

    if (CANCELLABLE_BY_CUSTOMER.has(order.status)) {
      return this.requestCancellation(orderId, reason);
    }

    throw new BadRequestException('Este pedido ya no puede cancelarse.');
  }

  /**
   * Flags the order for cancellation without changing its status — the
   * branch is the one who decides whether preparation has gone too far to
   * stop (SEIS-adjacent: same "the DB, not the client, decides" principle
   * as every other transition, just without a status change of its own).
   */
  private async requestCancellation(orderId: string, reason?: string) {
    const trimmedReason = reason?.trim() || null;

    const order = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, cancellationRequestedAt: true },
      });
      if (!current) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      if (!CANCELLABLE_BY_CUSTOMER.has(current.status)) {
        throw new BadRequestException('Este pedido ya no puede cancelarse.');
      }
      if (current.cancellationRequestedAt) {
        throw new ConflictException('Ya existe una solicitud de cancelación pendiente para este pedido.');
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: current.status, cancellationRequestedAt: null },
        data: { cancellationRequestedAt: new Date(), cancellationRequestReason: trimmedReason },
      });
      if (updated.count === 0) {
        throw new ConflictException('El pedido ya fue actualizado por otra operación. Vuelve a consultarlo.');
      }

      // Not a status transition (fromStatus === toStatus) — logged anyway so
      // the timeline shows the request even though Order.status didn't move.
      await tx.orderStatusHistory.create({
        data: {
          id: randomUUID(),
          orderId,
          fromStatus: current.status,
          toStatus: current.status,
          staffId: null,
          reason: trimmedReason,
          metadata: { event: 'cancellation_requested' },
        },
      });

      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      return this.serializeOrder(updatedOrder);
    });

    this.ordersGateway.notifyOrderStatusChanged({
      id: order.id,
      branchId: order.branchId,
      customerId: order.customerId,
      status: order.status,
    });

    return order;
  }

  /**
   * Branch's answer to a pending cancellation request. Authorization (staff
   * session + branch scoping) is the caller's responsibility (OrderController).
   */
  async resolveCancellationRequest(orderId: string, staffId: string, approve: boolean, note?: string) {
    const trimmedNote = note?.trim() || null;

    const order = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, cancellationRequestedAt: true },
      });
      if (!current) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      if (!current.cancellationRequestedAt) {
        throw new BadRequestException('Este pedido no tiene una solicitud de cancelación pendiente.');
      }

      if (approve) {
        if (!isTransitionAllowed(current.status, OrderStatus.CANCELLED)) {
          throw new BadRequestException(`No se puede cancelar un pedido en estado "${current.status}".`);
        }

        const updated = await tx.order.updateMany({
          where: { id: orderId, status: current.status },
          data: {
            status: OrderStatus.CANCELLED,
            cancellationRequestedAt: null,
            cancellationRequestReason: null,
          },
        });
        if (updated.count === 0) {
          throw new ConflictException('El pedido ya fue actualizado por otra operación. Vuelve a consultarlo.');
        }

        await tx.orderStatusHistory.create({
          data: {
            id: randomUUID(),
            orderId,
            fromStatus: current.status,
            toStatus: OrderStatus.CANCELLED,
            staffId,
            reason: trimmedNote || 'Cancelación aprobada por la sucursal.',
          },
        });
      } else {
        const updated = await tx.order.updateMany({
          where: { id: orderId, cancellationRequestedAt: { not: null } },
          data: { cancellationRequestedAt: null, cancellationRequestReason: null },
        });
        if (updated.count === 0) {
          throw new ConflictException('La solicitud ya fue resuelta.');
        }

        await tx.orderStatusHistory.create({
          data: {
            id: randomUUID(),
            orderId,
            fromStatus: current.status,
            toStatus: current.status,
            staffId,
            reason: trimmedNote || 'Cancelación rechazada por la sucursal.',
            metadata: { event: 'cancellation_rejected' },
          },
        });
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      return this.serializeOrder(updatedOrder);
    });

    this.ordersGateway.notifyOrderStatusChanged({
      id: order.id,
      branchId: order.branchId,
      customerId: order.customerId,
      status: order.status,
    });

    return order;
  }
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
