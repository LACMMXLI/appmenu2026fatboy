import { describe, expect, it } from 'vitest';
import type { PrintableOrder } from '../desktop/desktop-types';
import { buildTicketHtml, escapeHtml } from './ticketTemplate';

const order: PrintableOrder = {
  id: 'order-1',
  folio: 'FB-100',
  branchId: 'branch-centro',
  branchName: 'Sucursal Centro',
  customerName: '<script>alert("cliente")</script>',
  customerPhone: '686-000-0000',
  total: 249.5,
  pointsRedeemed: 0,
  deliveryType: 'pickup',
  paymentMethod: 'cash',
  notes: 'Sin cebolla & con salsa <fuerte>',
  createdAt: '2026-08-19T18:00:00.000Z',
  items: [
    {
      productName: 'Hamburguesa "Especial"',
      price: 249.5,
      quantity: 1,
      meatPrep: '3/4',
      extras: JSON.stringify([{ name: 'Queso extra' }]),
      removals: JSON.stringify(['Cebolla']),
    },
  ],
};

describe('ticketTemplate', () => {
  it('escapa contenido controlado por clientes y productos', () => {
    const html = buildTicketHtml(order, 80, 'CUSTOMER');

    expect(html).not.toContain('<script>alert("cliente")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;cliente&quot;)&lt;/script&gt;');
    expect(html).toContain('Sin cebolla &amp; con salsa &lt;fuerte&gt;');
    expect(html).toContain('Hamburguesa &quot;Especial&quot;');
  });

  it.each([58, 80] as const)('genera el perfil térmico de %i mm', (width) => {
    const html = buildTicketHtml(order, width, 'CUSTOMER');
    expect(html).toContain(`data-paper-width="${width}"`);
    expect(html).toContain(`width: ${width}mm`);
  });

  it('genera una comanda de cocina sin precios ni datos de cobro', () => {
    const html = buildTicketHtml(order, 80, 'PRODUCTION');
    expect(html).toContain('data-document-type="PRODUCTION"');
    expect(html).toContain('COMANDA DE COCINA');
    expect(html).toContain('Término: 3/4');
    expect(html).toContain('Extras: Queso extra');
    expect(html).toContain('Sin: Cebolla');
    expect(html).not.toContain('Teléfono');
    expect(html).not.toContain('Pago');
    expect(html).not.toContain('Total');
    expect(html).not.toContain('$249.50');
  });

  it('genera el ticket del cliente con contacto, pago y total', () => {
    const html = buildTicketHtml(order, 80, 'CUSTOMER');
    expect(html).toContain('data-document-type="CUSTOMER"');
    expect(html).toContain('TICKET DEL CLIENTE');
    expect(html).toContain('686-000-0000');
    expect(html).toContain('Pago');
    expect(html).toContain('Total');
    expect(html).toContain('$249.50');
  });

  it('escapa todos los caracteres HTML sensibles', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
  });
});
