import type { PrintResult } from '../desktop/desktop-types';
import type { Order } from './api';

const AUTO_PRINT_QUEUE_PREFIX = 'fatboy-pedidos-auto-print:';
const MAX_QUEUED_ORDER_IDS = 100;

export type AutoOrderEvent =
  | { type: 'accepted-and-printed'; order: Order; message: string }
  | { type: 'queued-print-completed'; order: Order; message: string }
  | { type: 'print-failed'; order: Order; message: string }
  | { type: 'accept-failed'; order: Order; message: string };

interface AutoOrderProcessorOptions {
  branchId: string;
  orders: Order[];
  storage: Storage;
  processingIds: Set<string>;
  accept: (order: Order) => Promise<Order>;
  print: (order: Order) => Promise<PrintResult>;
  onUpdated: (order: Order) => void;
}

function queueKey(branchId: string): string {
  return `${AUTO_PRINT_QUEUE_PREFIX}${branchId}`;
}

export function readAutoPrintQueue(storage: Storage, branchId: string): string[] {
  try {
    const value = JSON.parse(storage.getItem(queueKey(branchId)) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
      .slice(-MAX_QUEUED_ORDER_IDS);
  } catch {
    return [];
  }
}

function writeAutoPrintQueue(storage: Storage, branchId: string, orderIds: string[]) {
  storage.setItem(queueKey(branchId), JSON.stringify([...new Set(orderIds)].slice(-MAX_QUEUED_ORDER_IDS)));
}

export function enqueueAutoPrint(storage: Storage, branchId: string, orderId: string) {
  writeAutoPrintQueue(storage, branchId, [...readAutoPrintQueue(storage, branchId), orderId]);
}

export function dequeueAutoPrint(storage: Storage, branchId: string, orderId: string) {
  writeAutoPrintQueue(
    storage,
    branchId,
    readAutoPrintQueue(storage, branchId).filter((queuedId) => queuedId !== orderId),
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Procesa una fotografía de los pedidos activos. El backend sigue siendo la
 * autoridad: sólo imprime después de que `/accept` devuelve `ACCEPTED`.
 * Los trabajos que Windows rechaza permanecen en una cola local para que el
 * siguiente ciclo los reintente sin volver a aceptar el pedido.
 */
export async function processAutomaticOrdersOnce({
  branchId,
  orders,
  storage,
  processingIds,
  accept,
  print,
  onUpdated,
}: AutoOrderProcessorOptions): Promise<AutoOrderEvent[]> {
  const events: AutoOrderEvent[] = [];
  const branchOrders = orders.filter((order) => order.branchId === branchId);
  const orderById = new Map(branchOrders.map((order) => [order.id, order]));

  for (const orderId of readAutoPrintQueue(storage, branchId)) {
    const order = orderById.get(orderId);
    if (!order || order.status === 'PENDING_APPROVAL' || processingIds.has(order.id)) continue;

    processingIds.add(order.id);
    try {
      const result = await print(order);
      if (result.ok) {
        dequeueAutoPrint(storage, branchId, order.id);
        events.push({ type: 'queued-print-completed', order, message: result.message });
      } else {
        events.push({ type: 'print-failed', order, message: result.message });
      }
    } catch (error) {
      events.push({ type: 'print-failed', order, message: errorMessage(error, 'No se pudo imprimir el ticket.') });
    } finally {
      processingIds.delete(order.id);
    }
  }

  const pendingOrders = branchOrders
    .filter((order) => order.status === 'PENDING_APPROVAL')
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  for (const order of pendingOrders) {
    if (processingIds.has(order.id)) continue;
    processingIds.add(order.id);
    try {
      const updated = await accept(order);
      if (updated.branchId !== branchId || updated.status !== 'ACCEPTED') {
        throw new Error('El backend no confirmó la aceptación del pedido.');
      }

      onUpdated(updated);
      enqueueAutoPrint(storage, branchId, updated.id);
      let result: PrintResult;
      try {
        result = await print(updated);
      } catch (error) {
        events.push({
          type: 'print-failed',
          order: updated,
          message: errorMessage(error, 'No se pudo imprimir el ticket.'),
        });
        continue;
      }
      if (result.ok) {
        dequeueAutoPrint(storage, branchId, updated.id);
        events.push({ type: 'accepted-and-printed', order: updated, message: result.message });
      } else {
        events.push({ type: 'print-failed', order: updated, message: result.message });
      }
    } catch (error) {
      events.push({
        type: 'accept-failed',
        order,
        message: errorMessage(error, 'No se pudo aceptar automáticamente el pedido.'),
      });
    } finally {
      processingIds.delete(order.id);
    }
  }

  return events;
}
