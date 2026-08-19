import { describe, expect, it } from 'vitest';
import { DESKTOP_CHANNELS } from '../../src/desktop/desktop-types';
import { parsePrintableOrder, parsePrinterSettingsInput } from './validation';

const validOrder = {
  id: 'order-1',
  folio: 'FB-100',
  branchId: 'branch-centro',
  branchName: 'Centro',
  customerName: 'Cliente',
  customerPhone: '6860000000',
  total: 100,
  pointsRedeemed: 0,
  deliveryType: 'pickup',
  paymentMethod: 'cash',
  notes: null,
  createdAt: '2026-08-19T18:00:00.000Z',
  items: [
    {
      productName: 'Hamburguesa',
      price: 100,
      quantity: 1,
      meatPrep: null,
      extras: null,
      removals: null,
    },
  ],
};

describe('contrato IPC de impresión', () => {
  it('acepta únicamente anchos térmicos soportados', () => {
    const settings = {
      branchId: 'branch-centro',
      branchName: 'Centro',
      deviceName: 'EPSON-TM',
      paperWidthMm: 80,
      autoAcceptEnabled: true,
    } as const;
    expect(parsePrinterSettingsInput(settings)).toEqual(settings);
    expect(() => parsePrinterSettingsInput({ ...settings, paperWidthMm: 72 })).toThrow('58 mm u 80 mm');
    expect(() => parsePrinterSettingsInput({ ...settings, autoAcceptEnabled: 'sí' })).toThrow('habilitada o deshabilitada');
  });

  it('clona un pedido válido y rechaza estructuras peligrosas', () => {
    expect(parsePrintableOrder(validOrder)).toEqual(validOrder);
    expect(() => parsePrintableOrder({ ...validOrder, items: [] })).toThrow('lista válida');
    expect(() => parsePrintableOrder({ ...validOrder, total: Number.NaN })).toThrow('Total inválido');
    expect(() => parsePrintableOrder({ ...validOrder, items: [{ ...validOrder.items[0], quantity: 1_000 }] })).toThrow('Cantidad inválida');
  });

  it('expone solo canales de escritorio explícitos y con prefijo', () => {
    const channels = Object.values(DESKTOP_CHANNELS);
    expect(new Set(channels).size).toBe(channels.length);
    expect(channels.every((channel) => channel.startsWith('desktop:'))).toBe(true);
  });
});
