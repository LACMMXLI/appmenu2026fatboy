import type { Order } from './api';
import { currency, parseJsonList } from './orderHelpers';

// Impresión manual desde el navegador (Sección Diecisiete del plan). No es
// impresión silenciosa ni un servicio local — se queda deliberadamente
// simple hasta una fase posterior.
export function printOrder(order: Order): string | null {
  const lines = order.items
    .map((item) => {
      const extras = parseJsonList(item.extras);
      const removals = parseJsonList(item.removals);
      const modifiers = [
        item.meatPrep ? `Termino: ${item.meatPrep}` : '',
        extras.length ? `Extras: ${extras.join(', ')}` : '',
        removals.length ? `Sin: ${removals.join(', ')}` : '',
      ].filter(Boolean);

      return `
        <div class="item">
          <strong>${item.quantity} x ${item.productName}</strong>
          <span>${currency(item.price * item.quantity)}</span>
          ${modifiers.length ? `<small>${modifiers.join(' | ')}</small>` : ''}
        </div>
      `;
    })
    .join('');

  const ticket = window.open('', '_blank', 'width=420,height=720');
  if (!ticket) {
    return 'El navegador bloqueó la ventana de impresión.';
  }

  ticket.document.write(`
    <html>
      <head>
        <title>Pedido ${order.folio}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #111; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          .muted { color: #555; font-size: 12px; }
          .row { display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; }
          .item { border-top: 1px dashed #999; padding: 9px 0; display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; }
          .item small { grid-column: 1 / -1; color: #444; }
          .note { border: 1px solid #111; padding: 8px; margin-top: 10px; font-weight: 700; }
          .total { border-top: 2px solid #111; padding-top: 10px; margin-top: 10px; font-size: 18px; font-weight: 900; }
          @media print { body { width: 80mm; padding: 8px; } }
        </style>
      </head>
      <body>
        <h1>FATBOY ${order.folio}</h1>
        <div class="muted">${order.branchName} | ${new Date(order.createdAt).toLocaleString('es-MX')}</div>
        <div class="row"><strong>Cliente</strong><span>${order.customerName}</span></div>
        <div class="row"><strong>Telefono</strong><span>${order.customerPhone}</span></div>
        <div class="row"><strong>Tipo</strong><span>${order.deliveryType === 'delivery' ? 'Entrega' : 'Recoger'}</span></div>
        <div class="row"><strong>Pago</strong><span>${order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span></div>
        ${lines}
        ${order.notes ? `<div class="note">NOTA: ${order.notes}</div>` : ''}
        ${order.pointsRedeemed ? `<div class="row"><strong>Puntos usados</strong><span>${order.pointsRedeemed}</span></div>` : ''}
        <div class="row total"><strong>Total</strong><span>${currency(order.total)}</span></div>
        <script>window.print(); window.setTimeout(() => window.close(), 500);</script>
      </body>
    </html>
  `);
  ticket.document.close();
  return null;
}
