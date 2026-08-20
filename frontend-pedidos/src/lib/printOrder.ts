import type { Order } from './api';
import type { PrintDocumentType, PrintResult } from '../desktop/desktop-types';
import { getDesktopApi } from '../desktop/desktop-bridge';
import { buildTicketHtml, toPrintableOrder } from './ticketTemplate';

export async function printOrder(order: Order, documentType: PrintDocumentType): Promise<PrintResult> {
  const printableOrder = toPrintableOrder(order);
  const desktopApi = getDesktopApi();

  if (desktopApi) {
    try {
      return await desktopApi.printOrder(printableOrder, documentType);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'La aplicación de escritorio no respondió.',
      };
    }
  }

  const ticket = window.open('', '_blank', 'width=420,height=720');
  if (!ticket) {
    return { ok: false, message: 'El navegador bloqueó la ventana de impresión.' };
  }

  ticket.addEventListener('load', () => {
    ticket.focus();
    ticket.print();
    window.setTimeout(() => ticket.close(), 500);
  });
  ticket.document.write(buildTicketHtml(printableOrder, 80, documentType));
  ticket.document.close();

  return { ok: true, message: 'Se abrió el diálogo de impresión.' };
}
