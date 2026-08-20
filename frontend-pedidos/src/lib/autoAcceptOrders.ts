import type { PrintResult } from '../desktop/desktop-types';
import type { ClaimedPrintJobResponse, Order, PrintJob } from './api';

const MAX_JOBS_PER_CYCLE = 20;

export type AutoOrderEvent =
  | { type: 'accepted'; order: Order; message: string }
  | { type: 'printed'; order: Order; job: PrintJob; message: string }
  | { type: 'print-failed'; order: Order; job: PrintJob; message: string }
  | { type: 'ack-failed'; order: Order; job: PrintJob; message: string }
  | { type: 'queue-failed'; order: Order; job: PrintJob; message: string }
  | { type: 'queue-unavailable'; message: string }
  | { type: 'accept-failed'; order: Order; message: string };

interface AutoOrderProcessorOptions {
  branchId: string;
  orders: Order[];
  processingIds: Set<string>;
  accept: (order: Order) => Promise<Order>;
  claim: () => Promise<ClaimedPrintJobResponse>;
  start: (job: PrintJob) => Promise<PrintJob>;
  print: (order: Order, job: PrintJob) => Promise<PrintResult>;
  complete: (job: PrintJob, result: PrintResult) => Promise<PrintJob>;
  fail: (job: PrintJob, error: string) => Promise<PrintJob>;
  onUpdated: (order: Order) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Acepta pedidos de la sucursal y consume la cola persistente del backend.
 * El backend reclama cada trabajo para una sola estación. Si Windows acepta
 * la impresión pero se pierde el ACK final, el trabajo queda PRINTING y el
 * servidor lo cambia a UNCERTAIN: nunca se reimprime automáticamente.
 */
export async function processAutomaticOrdersOnce({
  branchId,
  orders,
  processingIds,
  accept,
  claim,
  start,
  print,
  complete,
  fail,
  onUpdated,
}: AutoOrderProcessorOptions): Promise<AutoOrderEvent[]> {
  const events: AutoOrderEvent[] = [];
  const pendingOrders = orders
    .filter((order) => order.branchId === branchId && order.status === 'PENDING_APPROVAL')
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
      events.push({ type: 'accepted', order: updated, message: 'Pedido aceptado automáticamente.' });
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

  for (let index = 0; index < MAX_JOBS_PER_CYCLE; index += 1) {
    let claimed: ClaimedPrintJobResponse;
    try {
      claimed = await claim();
    } catch (error) {
      events.push({
        type: 'queue-unavailable',
        message: errorMessage(error, 'No se pudo consultar la cola de impresión.'),
      });
      break;
    }

    if (!claimed.job || !claimed.order) break;
    const { job, order } = claimed;
    if (job.branchId !== branchId || order.branchId !== branchId || job.orderId !== order.id) break;
    if (processingIds.has(order.id)) break;

    processingIds.add(order.id);
    try {
      try {
        await start(job);
      } catch (error) {
        const message = errorMessage(error, 'No se pudo iniciar el trabajo de impresión.');
        try {
          await fail(job, message);
        } catch {
          // El lease del backend recuperará el trabajo si tampoco pudo marcarse como fallido.
        }
        events.push({ type: 'queue-failed', order, job, message });
        continue;
      }

      let result: PrintResult;
      try {
        result = await print(order, job);
      } catch (error) {
        result = { ok: false, message: errorMessage(error, 'No se pudo imprimir el ticket.') };
      }

      if (!result.ok) {
        try {
          await fail(job, result.message);
        } catch {
          // Conservamos el error original; el lease protege contra un duplicado inmediato.
        }
        events.push({ type: 'print-failed', order, job, message: result.message });
        continue;
      }

      try {
        await complete(job, result);
        events.push({ type: 'printed', order, job, message: result.message });
      } catch (error) {
        // Nunca se marca FAILED después de imprimir: un reintento automático
        // podría producir un ticket duplicado. El backend lo hará UNCERTAIN.
        events.push({
          type: 'ack-failed',
          order,
          job,
          message: errorMessage(error, 'Windows recibió el ticket, pero el servidor no pudo confirmarlo.'),
        });
      }
    } finally {
      processingIds.delete(order.id);
    }
  }

  return events;
}
