import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, LogOut, MapPin, RefreshCw, ShoppingBag, Store, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, OrderCard } from '@/components/OrderCard';
import { RejectOrderModal } from '@/components/RejectOrderModal';
import { cn } from '@/lib/utils';
import { useStaffSession } from '@/context/StaffSessionContext';
import { useOrdersSocket } from '@/lib/useOrdersSocket';
import { useOrdersData } from '@/lib/useOrdersData';
import { printOrder } from '@/lib/printOrder';
import {
  acceptOrder,
  approveCancellation,
  rejectCancellation,
  rejectOrder,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '@/lib/api';

type Tab = 'active' | 'completed';

// Tablero operativo (Sección Siete/Nueve-Diecisiete del plan): agrupa por
// estado, sincroniza por socket + refetch HTTP, y ejecuta acciones siempre
// esperando la confirmación del backend antes de reflejarlas (Sección
// Once: nunca optimistic UI). El layout final de columnas/tarjetas se
// refina en la Fase tres — esto ya es la operación real, funcionando.
export function OperationView() {
  const { staff, token, branches, effectiveBranchId, selectedBranchId, setSelectedBranchId, logout } = useStaffSession();
  const { orders, syncing, error, setError, refetch, applyUpdatedOrder } = useOrdersData(token, effectiveBranchId);

  const handleOrderEvent = useCallback(() => refetch(false), [refetch]);
  const { connected } = useOrdersSocket(token, effectiveBranchId, staff?.role === 'ADMIN', handleOrderEvent);

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [isActing, setIsActing] = useState(false);
  const [message, setMessage] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);

  const canCancel = staff?.role === 'MANAGER' || staff?.role === 'ADMIN';
  const selectedBranch = branches.find((b) => b.id === effectiveBranchId);

  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'PENDING_APPROVAL'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'READY'), [orders]);
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED' || o.status === 'REJECTED' || o.status === 'CANCELLED'),
    [orders],
  );

  // Toda acción sigue el mismo patrón: esperar la respuesta del backend,
  // aplicar exactamente lo que devolvió (nunca un estado adivinado), y ante
  // cualquier error (incluido un 409 de concurrencia) refrescar desde el
  // servidor — la fuente de verdad (Sección Once/Veintitrés).
  const runAction = useCallback(
    async (order: Order, action: () => Promise<Order>, successLabel: string) => {
      try {
        setIsActing(true);
        setMessage('');
        setError('');
        const updated = await action();
        applyUpdatedOrder(updated);
        setMessage(`Pedido ${order.folio}: ${successLabel}`);
        window.setTimeout(() => setMessage(''), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar el pedido.');
        refetch(false);
      } finally {
        setIsActing(false);
      }
    },
    [applyUpdatedOrder, refetch, setError],
  );

  function handleAccept(order: Order) {
    return runAction(order, () => acceptOrder(token, order.id), 'aceptado.');
  }

  function handleAdvance(order: Order, status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>) {
    return runAction(order, () => updateOrderStatus(token, order.id, status), 'actualizado.');
  }

  function handleApproveCancellation(order: Order) {
    return runAction(order, () => approveCancellation(token, order.id), 'cancelación aprobada.');
  }

  function handleRejectCancellation(order: Order) {
    return runAction(order, () => rejectCancellation(token, order.id), 'cancelación rechazada, el pedido continúa.');
  }

  async function confirmReject(reason: string) {
    if (!rejectTarget) return;
    const order = rejectTarget;
    setRejectTarget(null);
    await runAction(order, () => rejectOrder(token, order.id, reason), 'rechazado.');
  }

  function handlePrint(order: Order) {
    const failure = printOrder(order);
    if (failure) setError(failure);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#101010] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#171615]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Store size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-none tracking-wide">FATBOY PEDIDOS</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck size={13} /> {staff?.name} ({staff?.role})
                </span>
                {selectedBranch && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {selectedBranch.name}
                  </span>
                )}
                <span className={cn('inline-flex items-center gap-1', connected ? 'text-emerald-400' : 'text-amber-400')}>
                  {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
                  {connected ? 'Conectado' : 'Reconectando…'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {message && <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-300">{message}</span>}
            {error && <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-black text-primary"><AlertCircle size={14} /> {error}</span>}
            {staff?.role === 'ADMIN' && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-[#101010] px-3 text-xs font-black uppercase text-white outline-none focus:border-primary"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => refetch(true)} isLoading={syncing}>
              <RefreshCw size={15} className="mr-1" /> Sync
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logout}>
              <LogOut size={15} className="mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#11100f] px-4 py-2 lg:px-6">
        <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} Icon={ShoppingBag}>
          Pedidos activos <span>{pendingOrders.length + preparingOrders.length + readyOrders.length}</span>
        </TabButton>
        <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} Icon={CheckCircle2}>
          Historial <span>{completedOrders.length}</span>
        </TabButton>
      </nav>

      {activeTab === 'active' && (
        <section className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-3">
          <OrderColumn title="Nuevos" count={pendingOrders.length} tone="amber">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => setRejectTarget(order)}
                onApproveCancellation={() => handleApproveCancellation(order)}
                onRejectCancellation={() => handleRejectCancellation(order)}
                onAdvance={(status) => handleAdvance(order, status)}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Aceptados / preparación" count={preparingOrders.length} tone="sky">
            {preparingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => setRejectTarget(order)}
                onApproveCancellation={() => handleApproveCancellation(order)}
                onRejectCancellation={() => handleRejectCancellation(order)}
                onAdvance={(status) => handleAdvance(order, status)}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Listos" count={readyOrders.length} tone="emerald">
            {readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => setRejectTarget(order)}
                onApproveCancellation={() => handleApproveCancellation(order)}
                onRejectCancellation={() => handleRejectCancellation(order)}
                onAdvance={(status) => handleAdvance(order, status)}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>
        </section>
      )}

      {activeTab === 'completed' && (
        <section className="grid gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
          {completedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canCancel={canCancel}
              compact
              onAccept={() => handleAccept(order)}
              onReject={() => setRejectTarget(order)}
              onApproveCancellation={() => handleApproveCancellation(order)}
              onRejectCancellation={() => handleRejectCancellation(order)}
              onAdvance={(status) => handleAdvance(order, status)}
              onPrint={() => handlePrint(order)}
            />
          ))}
          {completedOrders.length === 0 && <EmptyState text="Todavía no hay pedidos finalizados, rechazados o cancelados en esta sucursal." />}
        </section>
      )}

      {rejectTarget && (
        <RejectOrderModal order={rejectTarget} onCancel={() => setRejectTarget(null)} onConfirm={confirmReject} />
      )}

      {isActing && <div className="fixed inset-0 z-40 cursor-wait" aria-hidden />}
    </main>
  );
}

function TabButton({ active, onClick, Icon, children }: { active: boolean; onClick: () => void; Icon: typeof ShoppingBag; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-black uppercase transition-colors',
        active ? 'border-primary bg-primary text-white' : 'border-white/10 bg-[#181818] text-gray-400 hover:text-white',
      )}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function OrderColumn({ title, count, tone, children }: { title: string; count: number; tone: 'amber' | 'sky' | 'emerald'; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col border-r border-white/10">
      <div className={cn('flex items-center justify-between border-b px-4 py-3 lg:px-6', tone === 'amber' && 'border-amber-400/10 bg-amber-400/5', tone === 'sky' && 'border-sky-400/10 bg-sky-400/5', tone === 'emerald' && 'border-emerald-400/10 bg-emerald-400/5')}>
        <h2 className={cn('font-display text-2xl leading-none tracking-wide', tone === 'amber' && 'text-amber-300', tone === 'sky' && 'text-sky-300', tone === 'emerald' && 'text-emerald-300')}>{title}</h2>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-black text-black', tone === 'amber' && 'bg-amber-300', tone === 'sky' && 'bg-sky-300', tone === 'emerald' && 'bg-emerald-300')}>{count}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:p-6">
        {children}
        {count === 0 && <EmptyState text="Sin pedidos en esta columna." />}
      </div>
    </div>
  );
}
