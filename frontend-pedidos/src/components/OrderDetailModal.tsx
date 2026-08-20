import { Check, Clock3, Phone, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { currency, orderAge, orderClockTime, parseJsonList } from '@/lib/orderHelpers';
import { ORDER_STATUS_LABELS_ES, type Order, type OrderStatus } from '@/lib/api';
import type { PrintDocumentType } from '@/desktop/desktop-types';

const statusTone: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  ACCEPTED: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  PREPARING: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  READY: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  COMPLETED: 'text-green-300 bg-green-400/10 border-green-400/25',
  REJECTED: 'text-red-300 bg-red-400/10 border-red-400/25',
  CANCELLED: 'text-red-300 bg-red-400/10 border-red-400/25',
};

// Vista de alta legibilidad (Sección Diez del plan): el objetivo es
// reducir errores de preparación, así que modificadores y notas llevan
// prioridad visual sobre todo lo demás.
export function OrderDetailModal({
  order,
  canCancel,
  onClose,
  onAccept,
  onReject,
  onAdvance,
  onPrint,
  onApproveCancellation,
  onRejectCancellation,
}: {
  order: Order;
  canCancel: boolean;
  onClose: () => void;
  onPrint: (documentType: PrintDocumentType) => void | Promise<void>;
  // Un pedido terminal (Historial) nunca renderiza los botones que
  // llamarían a esto — no permitir modificar pedidos terminales (Sección
  // Veinte) — así que ahí ni siquiera hace falta pasarlos.
  onAccept?: () => void;
  onReject?: () => void;
  onAdvance?: (status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>) => void;
  onApproveCancellation?: () => void;
  onRejectCancellation?: () => void;
}) {
  const isTerminal = order.status === 'COMPLETED' || order.status === 'REJECTED' || order.status === 'CANCELLED';
  const canPrintProduction = order.status === 'ACCEPTED'
    || order.status === 'PREPARING'
    || order.status === 'READY'
    || order.status === 'COMPLETED'
    || order.status === 'CANCELLED';
  const canPrintCustomer = order.status === 'READY' || order.status === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#181818] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-4xl leading-none tracking-wide">{order.folio}</h2>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', statusTone[order.status])}>
                {ORDER_STATUS_LABELS_ES[order.status]}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-gray-400">
              {orderClockTime(order.createdAt)} · {orderAge(order.createdAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-1 text-sm">
            <p className="font-black text-white">{order.customerName}</p>
            <p className="inline-flex items-center gap-1.5 font-semibold text-gray-400">
              <Phone size={13} /> {order.customerPhone}
            </p>
            <div className="mt-2 flex gap-2 text-xs font-bold text-gray-300">
              <span className="rounded-md bg-black/20 px-2 py-1">{order.deliveryType === 'delivery' ? 'Entrega' : 'Recoger'}</span>
              <span className="rounded-md bg-black/20 px-2 py-1">{order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span>
            </div>
          </div>

          <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
            {order.items.map((item) => {
              const extras = parseJsonList(item.extras);
              const removals = parseJsonList(item.removals);
              const hasModifiers = Boolean(item.meatPrep) || extras.length > 0 || removals.length > 0;
              return (
                <div key={item.id}>
                  <div className="flex justify-between gap-2 text-base font-black text-white">
                    <span>{item.quantity} × {item.productName}</span>
                    <span>{currency(item.price * item.quantity)}</span>
                  </div>
                  {hasModifiers && (
                    <ul className="mt-1.5 space-y-1 pl-1">
                      {item.meatPrep && <li className="text-sm font-bold text-gold">Termino: {item.meatPrep}</li>}
                      {extras.map((extra) => (
                        <li key={extra} className="text-sm font-bold text-emerald-300">+ {extra}</li>
                      ))}
                      {removals.map((removal) => (
                        <li key={removal} className="text-sm font-bold text-primary">Sin {removal}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {order.notes && (
            <div className="mt-4 rounded-lg border-2 border-gold/40 bg-gold/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gold">Nota del cliente</p>
              <p className="mt-1 text-sm font-bold text-white">"{order.notes}"</p>
            </div>
          )}

          {order.status === 'REJECTED' && order.rejectionReason && (
            <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm font-bold text-red-300">
              Motivo de rechazo: {order.rejectionReason}
            </div>
          )}

          {order.cancellationRequestedAt && (
            <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-300">
                <Clock3 size={13} /> Cliente solicitó cancelar
              </p>
              {order.cancellationRequestReason && (
                <p className="mt-1 text-xs font-semibold text-amber-200/90">Motivo: {order.cancellationRequestReason}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" size="sm" onClick={() => onApproveCancellation?.()} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check size={14} className="mr-1" /> Aprobar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onRejectCancellation?.()} className="border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
                  <X size={14} className="mr-1" /> Rechazar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            {order.pointsRedeemed > 0 && (
              <div className="flex justify-between text-sm font-semibold text-gray-400">
                <span>Puntos usados</span>
                <span>{order.pointsRedeemed}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-2xl font-black text-white">
              <span>Total</span>
              <span>{currency(order.total)}</span>
            </div>
          </div>
        </div>

        {!isTerminal && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
            {canPrintProduction && (
              <Button type="button" variant="outline" onClick={() => onPrint('PRODUCTION')} className={cn('border-white/10', canPrintCustomer ? '' : 'col-span-2')} size="lg">
                <Printer size={16} className="mr-2" /> Comanda cocina
              </Button>
            )}
            {canPrintCustomer && (
              <Button type="button" variant="outline" onClick={() => onPrint('CUSTOMER')} className="border-white/10" size="lg">
                <Printer size={16} className="mr-2" /> Ticket cliente
              </Button>
            )}
            {order.status === 'PENDING_APPROVAL' && (
              <>
                <Button type="button" variant="outline" onClick={() => onReject?.()} size="lg" className="border-primary/25 text-primary hover:bg-primary/10">
                  <X size={16} className="mr-2" /> Rechazar
                </Button>
                <Button type="button" onClick={() => onAccept?.()} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                  <Check size={16} className="mr-2" /> Aceptar
                </Button>
              </>
            )}
            {order.status === 'ACCEPTED' && (
              <Button type="button" onClick={() => onAdvance?.('PREPARING')} size="lg" className={cn('bg-sky-600 hover:bg-sky-700', canCancel ? '' : 'col-span-2')}>
                Iniciar preparación
              </Button>
            )}
            {order.status === 'PREPARING' && (
              <Button type="button" onClick={() => onAdvance?.('READY')} size="lg" className={cn('bg-emerald-600 hover:bg-emerald-700', canCancel ? '' : 'col-span-2')}>
                <Check size={16} className="mr-2" /> Marcar listo
              </Button>
            )}
            {order.status === 'READY' && (
              <Button type="button" onClick={() => onAdvance?.('COMPLETED')} size="lg" className="col-span-2 bg-emerald-600 hover:bg-emerald-700">
                <Check size={16} className="mr-2" /> Marcar entregado
              </Button>
            )}
            {(order.status === 'ACCEPTED' || order.status === 'PREPARING') && canCancel && (
              <Button type="button" variant="outline" onClick={() => onAdvance?.('CANCELLED')} size="lg" className="border-primary/25 text-primary hover:bg-primary/10">
                <X size={16} className="mr-2" /> Cancelar
              </Button>
            )}
          </div>
        )}

        {isTerminal && (canPrintProduction || canPrintCustomer) && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
            {canPrintProduction && (
              <Button type="button" variant="outline" onClick={() => onPrint('PRODUCTION')} className={cn('border-white/10', canPrintCustomer ? '' : 'col-span-2')} size="lg">
                <Printer size={16} className="mr-2" /> Comanda cocina
              </Button>
            )}
            {canPrintCustomer && (
              <Button type="button" variant="outline" onClick={() => onPrint('CUSTOMER')} className="border-white/10" size="lg">
                <Printer size={16} className="mr-2" /> Ticket cliente
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
