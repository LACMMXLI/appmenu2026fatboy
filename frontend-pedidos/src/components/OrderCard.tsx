import { Check, Clock, Clock3, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { currency, orderAge, parseJsonList } from '@/lib/orderHelpers';
import { ORDER_STATUS_LABELS_ES, type Order, type OrderStatus } from '@/lib/api';

const statusMeta: Record<OrderStatus, { tone: string; dot: string }> = {
  PENDING_APPROVAL: { tone: 'text-amber-300 bg-amber-400/10 border-amber-400/25', dot: 'bg-amber-300' },
  ACCEPTED: { tone: 'text-sky-300 bg-sky-400/10 border-sky-400/25', dot: 'bg-sky-300' },
  PREPARING: { tone: 'text-sky-300 bg-sky-400/10 border-sky-400/25', dot: 'bg-sky-300' },
  READY: { tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', dot: 'bg-emerald-300' },
  COMPLETED: { tone: 'text-green-300 bg-green-400/10 border-green-400/25', dot: 'bg-green-300' },
  REJECTED: { tone: 'text-red-300 bg-red-400/10 border-red-400/25', dot: 'bg-red-300' },
  CANCELLED: { tone: 'text-red-300 bg-red-400/10 border-red-400/25', dot: 'bg-red-300' },
};

export function OrderCard({
  order,
  canCancel,
  compact = false,
  onAccept,
  onReject,
  onAdvance,
  onPrint,
  onApproveCancellation,
  onRejectCancellation,
}: {
  key?: string;
  order: Order;
  canCancel: boolean;
  compact?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: (status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>) => void;
  onPrint: () => void;
  onApproveCancellation: () => void;
  onRejectCancellation: () => void;
}) {
  const meta = statusMeta[order.status];
  // Nunca imprimible antes de que la sucursal acepte (Sección Diecisiete).
  const canPrint = order.status !== 'PENDING_APPROVAL';

  return (
    <article
      className={cn(
        'rounded-lg border bg-[#1b1a19] p-4 shadow-lg',
        order.status === 'PENDING_APPROVAL'
          ? 'border-amber-400/25'
          : order.status === 'ACCEPTED' || order.status === 'PREPARING'
            ? 'border-sky-400/25'
            : order.status === 'READY'
              ? 'border-emerald-400/25'
              : 'border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl leading-none tracking-wide">{order.folio}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', meta.tone)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {ORDER_STATUS_LABELS_ES[order.status]}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-gray-400">{order.customerName} | {order.customerPhone}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-white">{currency(order.total)}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase text-gray-500">{orderAge(order.createdAt)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
        <span className="rounded-md bg-black/20 px-2 py-1">{order.deliveryType === 'delivery' ? 'Entrega' : 'Recoger'}</span>
        <span className="rounded-md bg-black/20 px-2 py-1">{order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span>
      </div>

      {!compact && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <ul className="space-y-2">
            {order.items.map((item) => {
              const extras = parseJsonList(item.extras);
              const removals = parseJsonList(item.removals);
              return (
                <li key={item.id} className="text-xs text-gray-300">
                  <div className="flex justify-between gap-2 font-black text-white">
                    <span>{item.quantity}x {item.productName}</span>
                    <span>{currency(item.price * item.quantity)}</span>
                  </div>
                  {(item.meatPrep || extras.length > 0 || removals.length > 0) && (
                    <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                      {[item.meatPrep ? `Termino: ${item.meatPrep}` : '', extras.length ? `Extras: ${extras.join(', ')}` : '', removals.length ? `Sin: ${removals.join(', ')}` : ''].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {order.notes && (
            <div className="mt-3 rounded-md border border-gold/20 bg-gold/10 p-2 text-xs font-bold text-gold">
              Nota: {order.notes}
            </div>
          )}
        </div>
      )}

      {order.status === 'REJECTED' && order.rejectionReason && (
        <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/10 p-2 text-xs font-bold text-red-300">
          Motivo de rechazo: {order.rejectionReason}
        </div>
      )}

      {order.cancellationRequestedAt && (
        <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 p-2">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-300">
            <Clock3 size={13} /> Cliente solicitó cancelar
          </p>
          {order.cancellationRequestReason && (
            <p className="mt-1 text-[11px] font-semibold text-amber-200/90">Motivo: {order.cancellationRequestReason}</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" onClick={onApproveCancellation} className="bg-emerald-600 hover:bg-emerald-700">
              <Check size={14} className="mr-1" /> Aprobar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRejectCancellation} className="border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
              <X size={14} className="mr-1" /> Rechazar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPrint}
          disabled={!canPrint}
          className="border-white/10"
          title={canPrint ? undefined : 'No se imprime hasta que el pedido sea aceptado.'}
        >
          <Printer size={14} className="mr-1" /> Imprimir
        </Button>
        {order.status === 'PENDING_APPROVAL' && (
          <>
            <Button type="button" size="sm" onClick={onAccept} className="bg-emerald-600 hover:bg-emerald-700">
              <Check size={14} className="mr-1" /> Aceptar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onReject} className="col-span-2 border-primary/25 text-primary hover:bg-primary/10">
              <X size={14} className="mr-1" /> Rechazar
            </Button>
          </>
        )}
        {order.status === 'ACCEPTED' && (
          <Button type="button" size="sm" onClick={() => onAdvance('PREPARING')} className="bg-sky-600 hover:bg-sky-700">
            Iniciar preparación
          </Button>
        )}
        {order.status === 'PREPARING' && (
          <Button type="button" size="sm" onClick={() => onAdvance('READY')} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Marcar listo
          </Button>
        )}
        {order.status === 'READY' && (
          <Button type="button" size="sm" onClick={() => onAdvance('COMPLETED')} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Marcar entregado
          </Button>
        )}
        {(order.status === 'ACCEPTED' || order.status === 'PREPARING') && canCancel && (
          <Button type="button" size="sm" variant="outline" onClick={() => onAdvance('CANCELLED')} className="border-primary/25 text-primary hover:bg-primary/10">
            <X size={14} className="mr-1" /> Cancelar
          </Button>
        )}
      </div>
    </article>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 p-5 text-center text-gray-500">
      <Clock size={30} className="mb-2 text-gray-600" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}
