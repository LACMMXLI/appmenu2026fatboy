import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currency, isOrderStale, orderAge, orderClockTime } from '@/lib/orderHelpers';
import type { Order, OrderStatus } from '@/lib/api';

const statusDot: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-300',
  ACCEPTED: 'bg-sky-300',
  PREPARING: 'bg-sky-300',
  READY: 'bg-emerald-300',
  COMPLETED: 'bg-green-300',
  REJECTED: 'bg-red-300',
  CANCELLED: 'bg-red-300',
};

// Tile operacional (Sección Siete del plan): lo que el empleado necesita
// ver de un vistazo en la pantalla principal, sin abrir nada. El detalle
// completo — modificadores, notas, acciones — vive en OrderDetailModal
// (Sección Diez), a un toque de distancia con "VER PEDIDO".
export function OrderSummaryCard({ order, onOpen }: { key?: string; order: Order; onOpen: () => void }) {
  const itemsSummary = order.items.map((item) => `${item.quantity} × ${item.productName}`).join(' · ');
  const stale = isOrderStale(order);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full rounded-lg border bg-[#1b1a19] p-4 text-left shadow-lg transition-colors active:scale-[0.99]',
        stale ? 'border-primary/40' : 'border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl leading-none tracking-wide">{order.folio}</h3>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDot[order.status])} />
            {stale && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary">
                <AlertTriangle size={11} /> Atrasado
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs font-bold text-gray-400">{order.customerName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-white">{orderClockTime(order.createdAt)}</p>
          <p className={cn('mt-0.5 text-[10px] font-bold uppercase', stale ? 'text-primary' : 'text-gray-500')}>{orderAge(order.createdAt)}</p>
        </div>
      </div>

      <p className="mt-3 truncate text-xs font-semibold text-gray-300">{itemsSummary}</p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-black text-white">{currency(order.total)}</span>
        <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-200">
          Ver pedido
        </span>
      </div>
    </button>
  );
}

export function EmptyColumn({ text }: { text: string }) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 p-5 text-center text-gray-500">
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}
