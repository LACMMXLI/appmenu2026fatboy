import { describe, expect, it, vi } from 'vitest';
import type { Order } from './api';
import { processAutomaticOrdersOnce, readAutoPrintQueue } from './autoAcceptOrders';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

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

describe('aceptación e impresión automática por sucursal', () => {
  it('acepta e imprime sólo pedidos de la sucursal configurada', async () => {
    const storage = new MemoryStorage();
    const americas = buildOrder();
    const venecia = buildOrder({ id: 'order-2', folio: 'FB-101', branchId: 'branch-venecia', branchName: 'Venecia' });
    const accepted = { ...americas, status: 'ACCEPTED' as const };
    const accept = vi.fn(async () => accepted);
    const print = vi.fn(async () => ({ ok: true, message: 'Impreso.' }));
    const onUpdated = vi.fn();

    const events = await processAutomaticOrdersOnce({
      branchId: americas.branchId,
      orders: [venecia, americas],
      storage,
      processingIds: new Set(),
      accept,
      print,
      onUpdated,
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(americas);
    expect(print).toHaveBeenCalledWith(accepted);
    expect(onUpdated).toHaveBeenCalledWith(accepted);
    expect(events.map((event) => event.type)).toEqual(['accepted-and-printed']);
    expect(readAutoPrintQueue(storage, americas.branchId)).toEqual([]);
  });

  it('conserva una impresión fallida y la reintenta sin volver a aceptar', async () => {
    const storage = new MemoryStorage();
    const pending = buildOrder();
    const accepted = { ...pending, status: 'ACCEPTED' as const };
    const accept = vi.fn(async () => accepted);

    const firstEvents = await processAutomaticOrdersOnce({
      branchId: pending.branchId,
      orders: [pending],
      storage,
      processingIds: new Set(),
      accept,
      print: vi.fn(async () => ({ ok: false, message: 'Impresora desconectada.' })),
      onUpdated: vi.fn(),
    });

    expect(firstEvents[0]?.type).toBe('print-failed');
    expect(readAutoPrintQueue(storage, pending.branchId)).toEqual([pending.id]);

    const retryPrint = vi.fn(async () => ({ ok: true, message: 'Impreso.' }));
    const retryEvents = await processAutomaticOrdersOnce({
      branchId: pending.branchId,
      orders: [accepted],
      storage,
      processingIds: new Set(),
      accept,
      print: retryPrint,
      onUpdated: vi.fn(),
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(retryPrint).toHaveBeenCalledWith(accepted);
    expect(retryEvents[0]?.type).toBe('queued-print-completed');
    expect(readAutoPrintQueue(storage, pending.branchId)).toEqual([]);
  });

  it('no imprime cuando el backend rechaza la aceptación', async () => {
    const pending = buildOrder();
    const print = vi.fn();
    const events = await processAutomaticOrdersOnce({
      branchId: pending.branchId,
      orders: [pending],
      storage: new MemoryStorage(),
      processingIds: new Set(),
      accept: vi.fn(async () => { throw new Error('Conflicto 409'); }),
      print,
      onUpdated: vi.fn(),
    });

    expect(print).not.toHaveBeenCalled();
    expect(events).toMatchObject([{ type: 'accept-failed', message: 'Conflicto 409' }]);
  });
});
