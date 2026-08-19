import type {
  PrintableOrder,
  PrintableOrderItem,
  PrinterSettingsInput,
} from '../../src/desktop/desktop-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${field} inválido.`);
  }
  return value.trim();
}

function nullableText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${field} inválido.`);
  }
  return value;
}

function finiteNumber(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${field} inválido.`);
  }
  return value;
}

export function parsePrinterSettingsInput(value: unknown): PrinterSettingsInput {
  if (!isRecord(value)) throw new Error('Configuración de impresora inválida.');
  const paperWidthMm = value.paperWidthMm;
  if (paperWidthMm !== 58 && paperWidthMm !== 80) {
    throw new Error('El ancho de papel debe ser 58 mm u 80 mm.');
  }
  return {
    deviceName: requiredText(value.deviceName, 'Impresora', 512),
    paperWidthMm,
  };
}

function parseOrderItem(value: unknown): PrintableOrderItem {
  if (!isRecord(value)) throw new Error('Producto de pedido inválido.');
  const quantity = finiteNumber(value.quantity, 'Cantidad', 1);
  if (!Number.isInteger(quantity) || quantity > 100) throw new Error('Cantidad inválida.');

  return {
    productName: requiredText(value.productName, 'Nombre de producto', 300),
    price: finiteNumber(value.price, 'Precio'),
    quantity,
    meatPrep: nullableText(value.meatPrep, 'Término', 100),
    extras: nullableText(value.extras, 'Extras', 4_000),
    removals: nullableText(value.removals, 'Ingredientes removidos', 4_000),
  };
}

export function parsePrintableOrder(value: unknown): PrintableOrder {
  if (!isRecord(value)) throw new Error('Pedido inválido para impresión.');
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 100) {
    throw new Error('El pedido no contiene una lista válida de productos.');
  }

  const createdAt = requiredText(value.createdAt, 'Fecha del pedido', 100);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Fecha del pedido inválida.');

  const pointsRedeemed = finiteNumber(value.pointsRedeemed, 'Puntos usados');
  if (!Number.isInteger(pointsRedeemed)) throw new Error('Puntos usados inválidos.');

  return {
    id: requiredText(value.id, 'Id de pedido', 100),
    folio: requiredText(value.folio, 'Folio', 100),
    branchName: requiredText(value.branchName, 'Sucursal', 200),
    customerName: requiredText(value.customerName, 'Cliente', 300),
    customerPhone: requiredText(value.customerPhone, 'Teléfono', 100),
    total: finiteNumber(value.total, 'Total'),
    pointsRedeemed,
    deliveryType: requiredText(value.deliveryType, 'Tipo de entrega', 50),
    paymentMethod: requiredText(value.paymentMethod, 'Método de pago', 50),
    notes: nullableText(value.notes, 'Notas', 1_500),
    createdAt,
    items: value.items.map(parseOrderItem),
  };
}
