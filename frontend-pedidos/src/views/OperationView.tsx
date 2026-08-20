import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Bell, CheckCircle2, ChefHat, LogOut, MapPin, RefreshCw, ShoppingBag, Store, UserCog, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyColumn, OrderSummaryCard } from '@/components/OrderSummaryCard';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { RejectOrderModal } from '@/components/RejectOrderModal';
import { PrinterSettingsDialog } from '@/components/PrinterSettingsDialog';
import { HistoryPanel } from '@/views/HistoryPanel';
import { AdminPanel } from '@/views/AdminPanel';
import { cn } from '@/lib/utils';
import { useStaffSession } from '@/context/StaffSessionContext';
import { useOrdersSocket } from '@/lib/useOrdersSocket';
import { useOrdersData } from '@/lib/useOrdersData';
import { useAutoAcceptOrders } from '@/lib/useAutoAcceptOrders';
import { printOrder } from '@/lib/printOrder';
import { getDesktopApi } from '@/desktop/desktop-bridge';
import type { PrinterSettings, PrintDocumentType } from '@/desktop/desktop-types';
import {
  acceptOrder,
  approveCancellation,
  rejectCancellation,
  rejectOrder,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '@/lib/api';

type Tab = 'active' | 'completed' | 'admin';

// Del más antiguo al más reciente dentro de cada estado (Sección Treinta y
// dos): un pedido nuevo nunca debe hacer desaparecer visualmente uno que
// lleva más tiempo esperando.
function sortOldestFirst(list: Order[]): Order[] {
  return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// Pantalla principal (Sección Siete del plan): los pedidos y sus estados son
// la superficie dominante. Identidad, sucursal y herramientas viven en una
// barra compacta; el detalle se abre aparte en OrderDetailModal.
export function OperationView() {
  const { staff, token, branches, effectiveBranchId, selectedBranchId, setSelectedBranchId, logout } = useStaffSession();
  const { orders, syncing, error, setError, refetch, applyUpdatedOrder } = useOrdersData(token, effectiveBranchId);

  const handleOrderEvent = useCallback(() => refetch(false), [refetch]);
  const { connected } = useOrdersSocket(token, effectiveBranchId, staff?.role === 'ADMIN', handleOrderEvent);

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [message, setMessage] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);

  const canCancel = staff?.role === 'MANAGER' || staff?.role === 'ADMIN';
  const selectedBranch = branches.find((b) => b.id === effectiveBranchId);

  useEffect(() => {
    const desktopApi = getDesktopApi();
    setPrinterSettings(null);
    if (!desktopApi || !effectiveBranchId) return;

    let active = true;
    void desktopApi.getPrinterSettings(effectiveBranchId).then((response) => {
      if (!active) return;
      if (response.ok === false) {
        setError(response.error);
        return;
      }
      setPrinterSettings(response.data);
    });
    return () => {
      active = false;
    };
  }, [effectiveBranchId, setError]);

  const showAutomaticMessage = useCallback((value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(''), 4_000);
  }, []);
  const showAutomaticError = useCallback((value: string) => setError(value), [setError]);
  const refetchSilently = useCallback(() => {
    void refetch(false);
  }, [refetch]);

  useAutoAcceptOrders({
    token,
    branchId: effectiveBranchId,
    settings: printerSettings,
    orders,
    onUpdated: applyUpdatedOrder,
    onMessage: showAutomaticMessage,
    onError: showAutomaticError,
    refetch: refetchSilently,
  });
  // El pedido seleccionado se resuelve contra `orders` en cada render, así
  // que si un refetch/socket lo actualiza mientras el modal está abierto,
  // el modal siempre muestra el estado real del servidor (nunca uno viejo).
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  const pendingOrders = useMemo(() => sortOldestFirst(orders.filter((o) => o.status === 'PENDING_APPROVAL')), [orders]);
  const preparingOrders = useMemo(
    () => sortOldestFirst(orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING')),
    [orders],
  );
  const readyOrders = useMemo(() => sortOldestFirst(orders.filter((o) => o.status === 'READY')), [orders]);

  // Toda acción sigue el mismo patrón: esperar la respuesta del backend,
  // aplicar exactamente lo que devolvió (nunca un estado adivinado), y ante
  // cualquier error (incluido un 409 de concurrencia) refrescar desde el
  // servidor — la fuente de verdad (Sección Once/Veintitrés).
  const runAction = useCallback(
    async (order: Order, action: () => Promise<Order>, successLabel: string) => {
      try {
        setMessage('');
        setError('');
        const updated = await action();
        applyUpdatedOrder(updated);
        setMessage(`Pedido ${order.folio}: ${successLabel}`);
        window.setTimeout(() => setMessage(''), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar el pedido.');
        refetch(false);
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

  async function handlePrint(order: Order, documentType: PrintDocumentType) {
    setError('');
    setMessage('');
    const result = await printOrder(order, documentType);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`Pedido ${order.folio}: ${result.message}`);
    window.setTimeout(() => setMessage(''), 3500);
  }

  function openReject(order: Order) {
    setSelectedOrderId(null);
    setRejectTarget(order);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#101010] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#171615]/95 px-3 py-2 backdrop-blur-xl md:px-4 md:py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 md:flex-nowrap">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary md:h-8 md:w-8">
              <Store size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="shrink-0 font-display text-xl leading-none tracking-wide md:text-lg">FATBOY PEDIDOS</h1>
                <span className="hidden truncate text-[10px] font-bold text-gray-500 sm:inline">
                  {staff?.name} · {staff?.role}
                </span>
                <span
                  className={cn('inline-flex shrink-0 items-center gap-1 text-[10px] font-black', connected ? 'text-emerald-400' : 'text-amber-400')}
                  title={connected ? 'Conectado al servidor' : 'Reconectando al servidor'}
                >
                  {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span className="hidden xl:inline">{connected ? 'Conectado' : 'Reconectando'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
            {staff?.role === 'ADMIN' && (
              <label className="relative min-w-0" title="Sucursal operativa">
                <MapPin size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                <span className="sr-only">Sucursal</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="h-9 w-[148px] truncate rounded-md border border-white/10 bg-[#101010] pl-7 pr-2 text-[11px] font-black uppercase text-white outline-none focus:border-primary md:w-[132px]"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </label>
            )}
            {staff?.role !== 'ADMIN' && selectedBranch && (
              <span className="inline-flex h-9 max-w-[150px] items-center gap-1.5 truncate rounded-md border border-white/10 bg-[#101010] px-2 text-[11px] font-black uppercase text-gray-200">
                <MapPin size={13} className="shrink-0 text-gray-500" /> {selectedBranch.name}
              </span>
            )}
            <PrinterSettingsDialog
              token={token}
              branchId={effectiveBranchId}
              branchName={selectedBranch?.name ?? 'Sucursal'}
              settings={printerSettings}
              onSettingsChange={setPrinterSettings}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => refetch(true)} isLoading={syncing} title="Actualizar pedidos" aria-label="Actualizar pedidos" className="w-9 px-0 xl:w-auto xl:px-3">
              <RefreshCw size={15} className="xl:mr-1" /> <span className="hidden xl:inline">Actualizar</span>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="w-9 px-0 xl:w-auto xl:px-3">
              <LogOut size={15} className="xl:mr-1" /> <span className="hidden xl:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {(message || error) && (
        <div className="pointer-events-none fixed right-3 top-14 z-50 max-w-sm space-y-2">
          {message && <span className="block rounded-md border border-emerald-400/20 bg-[#17211b]/95 px-3 py-2 text-xs font-black text-emerald-300 shadow-xl">{message}</span>}
          {error && <span className="flex items-start gap-1.5 rounded-md border border-primary/20 bg-[#251617]/95 px-3 py-2 text-xs font-black text-primary shadow-xl"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</span>}
        </div>
      )}

      <nav className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 bg-[#11100f] px-3 py-1.5 md:flex-nowrap md:px-4">
        <div className="flex min-w-0 gap-1.5 overflow-x-auto">
          <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} Icon={ShoppingBag}>
            Pedidos <span>{pendingOrders.length + preparingOrders.length + readyOrders.length}</span>
          </TabButton>
          <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} Icon={CheckCircle2}>
            Historial
          </TabButton>
          {staff?.role === 'ADMIN' && (
            <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} Icon={UserCog}>
              Administración
            </TabButton>
          )}
        </div>

        {activeTab !== 'admin' && (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
            <StatusCounter label="Por aceptar" value={pendingOrders.length} tone="amber" Icon={Bell} />
            <StatusCounter label="Preparación" value={preparingOrders.length} tone="sky" Icon={ChefHat} />
            <StatusCounter label="Listos" value={readyOrders.length} tone="emerald" Icon={CheckCircle2} />
          </div>
        )}
      </nav>

      {activeTab === 'admin' && staff?.role === 'ADMIN' && (
        <AdminPanel token={token} currentStaff={staff} branches={branches} onOrdersDeleted={refetchSilently} />
      )}

      {activeTab === 'active' && (
        <section className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-3">
          <OrderColumn title="Nuevos" count={pendingOrders.length} tone="amber">
            {pendingOrders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} onOpen={() => setSelectedOrderId(order.id)} />
            ))}
          </OrderColumn>

          <OrderColumn title="Aceptados / preparación" count={preparingOrders.length} tone="sky">
            {preparingOrders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} onOpen={() => setSelectedOrderId(order.id)} />
            ))}
          </OrderColumn>

          <OrderColumn title="Listos" count={readyOrders.length} tone="emerald">
            {readyOrders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} onOpen={() => setSelectedOrderId(order.id)} />
            ))}
          </OrderColumn>
        </section>
      )}

      {activeTab === 'completed' && <HistoryPanel token={token} branchId={effectiveBranchId} />}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          canCancel={canCancel}
          onClose={() => setSelectedOrderId(null)}
          onAccept={() => handleAccept(selectedOrder)}
          onReject={() => openReject(selectedOrder)}
          onApproveCancellation={() => handleApproveCancellation(selectedOrder)}
          onRejectCancellation={() => handleRejectCancellation(selectedOrder)}
          onAdvance={(status) => handleAdvance(selectedOrder, status)}
          onPrint={(documentType) => handlePrint(selectedOrder, documentType)}
        />
      )}

      {rejectTarget && (
        <RejectOrderModal order={rejectTarget} onCancel={() => setRejectTarget(null)} onConfirm={confirmReject} />
      )}
    </main>
  );
}

function StatusCounter({ label, value, tone, Icon }: { label: string; value: number; tone: 'amber' | 'sky' | 'emerald'; Icon: typeof Bell }) {
  const tones = {
    amber: 'border-amber-400/15 bg-amber-400/5 text-amber-300',
    sky: 'border-sky-400/15 bg-sky-400/5 text-sky-300',
    emerald: 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300',
  };
  return (
    <div className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2', tones[tone])}>
      <Icon size={13} />
      <span className="hidden text-[10px] font-black uppercase tracking-wide sm:inline">{label}</span>
      <strong className="min-w-4 text-center text-sm font-black leading-none text-white">{value}</strong>
    </div>
  );
}

function TabButton({ active, onClick, Icon, children }: { active: boolean; onClick: () => void; Icon: typeof ShoppingBag; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-black uppercase transition-colors md:h-9',
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
      <div className={cn('flex items-center justify-between border-b px-4 py-2', tone === 'amber' && 'border-amber-400/10 bg-amber-400/5', tone === 'sky' && 'border-sky-400/10 bg-sky-400/5', tone === 'emerald' && 'border-emerald-400/10 bg-emerald-400/5')}>
        <h2 className={cn('font-display text-xl leading-none tracking-wide', tone === 'amber' && 'text-amber-300', tone === 'sky' && 'text-sky-300', tone === 'emerald' && 'text-emerald-300')}>{title}</h2>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black text-black', tone === 'amber' && 'bg-amber-300', tone === 'sky' && 'bg-sky-300', tone === 'emerald' && 'bg-emerald-300')}>{count}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 lg:p-4">
        {children}
        {count === 0 && <EmptyColumn text="Sin pedidos en esta columna." />}
      </div>
    </div>
  );
}
