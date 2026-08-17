import { OrderStatus } from '@prisma/client';

/**
 * The order state machine. Backend is the sole authority over which
 * transitions are legal — see "SIETE — MÁQUINA DE ESTADOS" in nuevo modulo.md.
 *
 * PENDING_APPROVAL → ACCEPTED | REJECTED
 * ACCEPTED         → PREPARING | CANCELLED
 * PREPARING        → READY | CANCELLED
 * READY            → COMPLETED
 * COMPLETED / REJECTED / CANCELLED are terminal.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_APPROVAL]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Transición de estado no permitida: ${from} → ${to}.`);
  }
}

// Human-facing labels — never expose raw enum values to customers/staff (DIEZ).
export const ORDER_STATUS_LABELS_ES: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'Pendiente de aceptación',
  ACCEPTED: 'Aceptado',
  PREPARING: 'En preparación',
  READY: 'Listo para recoger',
  COMPLETED: 'Entregado',
  REJECTED: 'No aceptado',
  CANCELLED: 'Cancelado',
};
