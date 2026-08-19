import { describe, expect, it, vi } from 'vitest';
import type { ClaimedPrintJobResponse, Order, PrintJob } from './api';
import { processAutomaticOrdersOnce } from './autoAcceptOrders';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    folio: 'FB-100',
    customerId: 'customer-1',
    customerName: 'Cliente',
    customerPhone: '6860000000',
    branchId: 'branch-americas',
    branchName: 'Américas',
    status: 'PENDING_APPROVAL',
    rejectionReason: null,
    cancellationRequestedAt: null,
    cancellationRequestReason: null,
    total: 100,
    pointsEarned: 0,
    pointsRedeemed: 0,
    deliveryType: 'pickup',
    paymentMethod: 'cash',
    notes: null,
    createdAt: '2026-08-19T18:00:00.000Z',
    items: [],
    ...overrides,
  };
}

function buildJob(order: Order, overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: 'job-1',
    orderId: order.id,
    branchId: order.branchId,
    documentType: 'PRODUCTION',
    status: 'CLAIMED',
    attempts: 1,
    claimedByStationId: '11111111-1111-4111-8111-111111111111',
    claimedByStationName: 'RECEPCION-1',
    claimedAt: '2026-08-19T18:00:01.000Z',
    leaseExpiresAt: '2026-08-19T18:01:01.000Z',
    nextAttemptAt: null,
    printingStartedAt: null,
    printedAt: null,
    uncertainAt: null,
    lastError: null,
    lastResult: null,
    createdAt: '2026-08-19T18:00:01.000Z',
    updatedAt: '2026-08-19T18:00:01.000Z',
    ...overrides,
  };
}

function claimedOnce(job: PrintJob, order: Order) {
  return vi.fn<() => Promise<ClaimedPrintJobResponse>>()
    .mockResolvedValueOnce({ job, order })
    .mockResolvedValue({ job: null, order: null });
}

function processorDefaults(order: Order, job: PrintJob) {
  return {
    branchId: order.branchId,
    orders: [] as Order[],
    processingIds: new Set<string>(),
    accept: vi.fn(async (value: Order) => ({ ...value, status: 'ACCEPTED' as const })),
    claim: claimedOnce(job, order),
    start: vi.fn(async () => ({ ...job, status: 'PRINTING' as const })),
    print: vi.fn(async () => ({ ok: true, message: 'Impreso.' })),
    complete: vi.fn(async () => ({ ...job, status: 'PRINTED' as const })),
    fail: vi.fn(async () => ({ ...job, status: 'FAILED' as const })),
    onUpdated: vi.fn(),
  };
}

describe('cola durable de aceptación e impresión', () => {
  it('acepta sólo pedidos pendientes de la sucursal configurada', async () => {
    const americas = buildOrder();
    const venecia = buildOrder({ id: 'order-2', branchId: 'branch-venecia', branchName: 'Venecia' });
    const accepted = { ...americas, status: 'ACCEPTED' as const };
    const accept = vi.fn(async () => accepted);

    const events = await processAutomaticOrdersOnce({
      ...processorDefaults(accepted, buildJob(accepted)),
      orders: [venecia, americas],
      accept,
      claim: vi.fn(async () => ({ job: null, order: null })),
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(americas);
    expect(events.map((event) => event.type)).toEqual(['accepted']);
  });

  it('reclama, inicia, imprime y confirma un trabajo', async () => {
    const order = buildOrder({ status: 'ACCEPTED' });
    const job = buildJob(order);
    const options = processorDefaults(order, job);

    const events = await processAutomaticOrdersOnce(options);

    expect(options.start).toHaveBeenCalledWith(job);
    expect(options.print).toHaveBeenCalledWith(order);
    expect(options.complete).toHaveBeenCalledWith(job, { ok: true, message: 'Impreso.' });
    expect(options.fail).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['printed']);
  });

  it('marca fallido cuando Windows rechaza el trabajo', async () => {
    const order = buildOrder({ status: 'ACCEPTED' });
    const job = buildJob(order);
    const options = processorDefaults(order, job);
    options.print.mockResolvedValue({ ok: false, message: 'Impresora desconectada.' });

    const events = await processAutomaticOrdersOnce(options);

    expect(options.fail).toHaveBeenCalledWith(job, 'Impresora desconectada.');
    expect(options.complete).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['print-failed']);
  });

  it('no marca fallido si el ticket salió pero se perdió el ACK', async () => {
    const order = buildOrder({ status: 'ACCEPTED' });
    const job = buildJob(order);
    const options = processorDefaults(order, job);
    options.complete.mockRejectedValue(new Error('Red desconectada'));

    const events = await processAutomaticOrdersOnce(options);

    expect(options.print).toHaveBeenCalledOnce();
    expect(options.fail).not.toHaveBeenCalled();
    expect(events).toMatchObject([{ type: 'ack-failed', message: 'Red desconectada' }]);
  });

  it('no imprime cuando el backend rechaza la aceptación', async () => {
    const pending = buildOrder();
    const job = buildJob(pending);
    const options = processorDefaults(pending, job);
    options.orders = [pending];
    options.accept.mockRejectedValue(new Error('Conflicto 409'));
    options.claim = vi.fn(async () => ({ job: null, order: null }));

    const events = await processAutomaticOrdersOnce(options);

    expect(options.print).not.toHaveBeenCalled();
    expect(events).toMatchObject([{ type: 'accept-failed', message: 'Conflicto 409' }]);
  });
});
