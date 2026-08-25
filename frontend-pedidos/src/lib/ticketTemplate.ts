import type { PrintableOrder, PaperWidthMm, PrintDocumentType } from '../desktop/desktop-types';
import type { Order } from './api';
import { currency, parseJsonList } from './orderHelpers';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toPrintableOrder(order: Order): PrintableOrder {
  return {
    id: order.id,
    folio: order.folio,
    branchId: order.branchId,
    branchName: order.branchName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    total: order.total,
    pointsRedeemed: order.pointsRedeemed,
    deliveryType: order.deliveryType,
    deliveryAddress: order.deliveryAddress,
    deliveryReference: order.deliveryReference,
    deliveryFee: order.deliveryFee,
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
      meatPrep: item.meatPrep,
      extras: item.extras,
      removals: item.removals,
    })),
  };
}

export function buildTicketHtml(
  order: PrintableOrder,
  paperWidthMm: PaperWidthMm,
  documentType: PrintDocumentType,
): string {
  const production = documentType === 'PRODUCTION';
  const isDelivery = order.deliveryType === 'delivery';
  const compact = paperWidthMm === 58;
  // Un roll de 80 mm no ofrece necesariamente 80 mm imprimibles: los
  // cabezales y drivers térmicos suelen reservar una franja a cada lado.
  // Este ancho seguro evita que Windows recorte cantidades, nombres o
  // importes aunque el papel esté configurado correctamente como 80 mm.
  const contentWidthMm = compact ? 48 : 68;
  const startFeedMm = compact ? 5 : 7;
  const cutFeedMm = compact ? 12 : 16;
  const fontSizePx = production ? (compact ? 13 : 15) : (compact ? 11 : 12);
  const titleSizePx = production ? (compact ? 25 : 30) : (compact ? 21 : 24);
  const createdAt = new Date(order.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? order.createdAt
    : createdAt.toLocaleString('es-MX', { timeZone: 'America/Tijuana' });

  const itemLines = order.items
    .map((item) => {
      const extras = parseJsonList(item.extras).map(escapeHtml);
      const removals = parseJsonList(item.removals).map(escapeHtml);
      const modifiers = [
        item.meatPrep ? `Término: ${escapeHtml(item.meatPrep)}` : '',
        extras.length ? `Extras: ${extras.join(', ')}` : '',
        removals.length ? `Sin: ${removals.join(', ')}` : '',
      ].filter(Boolean);

      return `
        <section class="item">
          <div class="item-main">
            <strong>${escapeHtml(item.quantity)} × ${escapeHtml(item.productName)}</strong>
            ${production ? '' : `<span>${escapeHtml(currency(item.price * item.quantity))}</span>`}
          </div>
          ${modifiers.length ? `<div class="modifiers">${modifiers.join('<br>')}</div>` : ''}
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="es-MX" data-paper-width="${paperWidthMm}" data-document-type="${documentType}">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <title>${production ? 'Comanda' : 'Ticket'} ${escapeHtml(order.folio)}</title>
    <style>
      @page { margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: ${paperWidthMm}mm; background: #fff; color: #000; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: ${fontSizePx}px; line-height: 1.28; overflow-wrap: anywhere; word-break: break-word; }
      .ticket { width: ${contentWidthMm}mm; margin: 0 auto; padding-top: ${startFeedMm}mm; }
      h1 { margin: 0; text-align: center; font-size: ${titleSizePx}px; line-height: 1; }
      .center { text-align: center; }
      .muted { margin-top: 1.5mm; font-size: ${compact ? 9 : 10}px; }
      .divider { border-top: 1px dashed #000; margin: 2mm 0; }
      .row, .item-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 2mm; margin: 1mm 0; max-width: 100%; }
      .row strong { flex: 0 0 auto; }
      .row span:last-child { min-width: 0; max-width: 70%; text-align: right; overflow-wrap: anywhere; }
      .item-main span:last-child { flex: 0 0 auto; text-align: right; white-space: nowrap; }
      .document-label { margin-top: 1.5mm; text-align: center; font-size: ${compact ? 13 : 15}px; font-weight: 900; letter-spacing: .08em; }
      .folio { margin-top: 1.5mm; text-align: center; font-size: ${production ? (compact ? 28 : 34) : (compact ? 18 : 21)}px; font-weight: 900; }
      .delivery-box { margin-top: 2mm; border: 1.5px solid #000; padding: 1.5mm 2mm; font-size: ${compact ? 11 : 13}px; }
      .delivery-box strong { display: block; font-size: ${compact ? 12 : 14}px; margin-bottom: 1mm; }
      .item { border-top: ${production ? '2px solid' : '1px dashed'} #000; padding: ${production ? '3mm' : '2mm'} 0; break-inside: avoid; }
      .item-main strong { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
      .modifiers { margin-top: 1mm; padding-left: 2mm; font-size: ${production ? (compact ? 12 : 14) : fontSizePx}px; font-weight: 800; }
      .note { margin-top: 2mm; border: 1.5px solid #000; padding: 2mm; font-weight: 700; white-space: pre-wrap; }
      .total { margin-top: 2mm; padding-top: 2mm; border-top: 2px solid #000; font-size: ${compact ? 16 : 18}px; font-weight: 900; }
      .footer { margin-top: 3mm; text-align: center; font-size: 9px; }
      .cut-feed { width: 100%; height: ${cutFeedMm}mm; }
    </style>
  </head>
  <body>
    <main class="ticket">
      <h1>FATBOY</h1>
      <div class="document-label">${production ? 'COMANDA DE COCINA' : 'TICKET DEL CLIENTE'}</div>
      <div class="folio">${escapeHtml(order.folio)}</div>
      <div class="center muted">${escapeHtml(order.branchName)} · ${escapeHtml(createdLabel)}</div>
      <div class="divider"></div>
      <div class="row"><strong>Cliente</strong><span>${escapeHtml(order.customerName)}</span></div>
      ${production && !isDelivery ? '' : `<div class="row"><strong>Teléfono</strong><span>${escapeHtml(order.customerPhone)}</span></div>`}
      <div class="row"><strong>Tipo</strong><span>${isDelivery ? 'A DOMICILIO' : 'PARA RECOGER'}</span></div>
      ${production ? '' : `<div class="row"><strong>Pago</strong><span>${order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span></div>`}
      ${isDelivery && order.deliveryAddress ? `
        <div class="delivery-box">
          <strong>ENTREGA A DOMICILIO:</strong>
          <div>${escapeHtml(order.deliveryAddress)}</div>
          ${order.deliveryReference ? `<div style="margin-top: 1mm; font-size: ${compact ? 10 : 11}px;"><em>Ref: ${escapeHtml(order.deliveryReference)}</em></div>` : ''}
        </div>
      ` : ''}
      <div class="divider"></div>
      ${itemLines}
      ${order.notes ? `<div class="note">NOTA: ${escapeHtml(order.notes)}</div>` : ''}
      ${!production && order.deliveryFee > 0 ? `<div class="row"><strong>Envío a domicilio</strong><span>${escapeHtml(currency(order.deliveryFee))}</span></div>` : ''}
      ${!production && order.pointsRedeemed > 0 ? `<div class="row"><strong>Puntos usados</strong><span>${escapeHtml(order.pointsRedeemed)}</span></div>` : ''}
      ${production ? '' : `<div class="row total"><strong>Total</strong><span>${escapeHtml(currency(order.total))}</span></div>`}
      <div class="footer">${production ? 'PRODUCCIÓN · NO ENTREGAR AL CLIENTE' : 'Gracias por tu compra'}</div>
    </main>
    <div class="cut-feed" aria-hidden="true"></div>
  </body>
</html>`;
}
