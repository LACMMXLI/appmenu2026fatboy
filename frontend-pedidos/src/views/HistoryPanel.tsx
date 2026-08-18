import { useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyColumn, OrderSummaryCard } from '@/components/OrderSummaryCard';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { useOrderHistory } from '@/lib/useOrderHistory';
import { printOrder } from '@/lib/printOrder';
import type { Order } from '@/lib/api';

// Sección Veinte/Veintiuno del plan: pedidos terminales (completados,
// rechazados, cancelados), búsqueda por folio/cliente/teléfono resuelta
// por el backend, y "cargar más" por cursor — nunca se descarga todo de
// una vez. Solo lectura: no permite modificar pedidos terminales.
export function HistoryPanel({ token, branchId }: { token: string; branchId: string }) {
  const { query, setQuery, items, hasMore, isLoading, isLoadingMore, error, loadMore } = useOrderHistory(token, branchId);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printError, setPrintError] = useState('');

  function handlePrint(order: Order) {
    const failure = printOrder(order);
    setPrintError(failure ?? '');
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/10 bg-[#151413] p-4 lg:px-6">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por folio, cliente o teléfono…"
            className="h-11 w-full rounded-lg border border-white/10 bg-[#101010] pl-9 pr-3 text-sm text-white outline-none focus:border-primary"
          />
        </div>
        {(error || printError) && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
            <AlertCircle size={13} /> {error || printError}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {isLoading && items.length === 0 ? (
          <p className="text-center text-xs font-black uppercase tracking-widest text-gray-500">Cargando…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((order) => (
                <OrderSummaryCard key={order.id} order={order} onOpen={() => setSelectedOrder(order)} />
              ))}
            </div>
            {items.length === 0 && (
              <EmptyColumn
                text={query ? `Sin resultados para "${query}".` : 'Todavía no hay pedidos finalizados, rechazados o cancelados en esta sucursal.'}
              />
            )}
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="outline" onClick={loadMore} isLoading={isLoadingMore}>
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          canCancel={false}
          onClose={() => setSelectedOrder(null)}
          onPrint={() => handlePrint(selectedOrder)}
        />
      )}
    </section>
  );
}
