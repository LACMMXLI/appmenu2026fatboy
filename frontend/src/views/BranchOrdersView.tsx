import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Gift,
  KeyRound,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserCog,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  getAdminOrders,
  getAdminRewardRedemptions,
  getBranches,
  updateAdminOrderStatus,
  type Branch,
  type Order,
  type RewardRedemption,
} from '@/lib/api';

type StaffRole = 'manager' | 'cashier' | 'admin';
type OrderTab = 'active' | 'completed' | 'redemptions';

const ROLE_STORAGE_KEY = 'fatboy-branch-role';
const BRANCH_STORAGE_KEY = 'fatboy-branch-id';

const roleConfig: Record<StaffRole, { label: string; short: string; description: string; Icon: typeof UserCog }> = {
  manager: {
    label: 'Encargado',
    short: 'Encargado',
    description: 'Acepta, imprime, finaliza y cancela pedidos de sucursal.',
    Icon: ShieldCheck,
  },
  cashier: {
    label: 'Caja 1',
    short: 'Caja 1',
    description: 'Recibe pedidos, cobra, imprime tickets y entrega canjes.',
    Icon: Wallet,
  },
  admin: {
    label: 'Administrador',
    short: 'Admin',
    description: 'Control completo de pedidos, cancelaciones y operación.',
    Icon: UserCog,
  },
};

const statusMeta: Record<Order['status'], { label: string; tone: string; dot: string }> = {
  pending: { label: 'Nuevo', tone: 'text-amber-300 bg-amber-400/10 border-amber-400/25', dot: 'bg-amber-300' },
  preparing: { label: 'En preparacion', tone: 'text-sky-300 bg-sky-400/10 border-sky-400/25', dot: 'bg-sky-300' },
  ready: { label: 'Listo', tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', dot: 'bg-emerald-300' },
  delivered: { label: 'Entregado', tone: 'text-green-300 bg-green-400/10 border-green-400/25', dot: 'bg-green-300' },
  cancelled: { label: 'Cancelado', tone: 'text-red-300 bg-red-400/10 border-red-400/25', dot: 'bg-red-300' },
};

function currency(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function shortOrderId(id: string) {
  return id.slice(0, 6).toUpperCase();
}

function parseJsonList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
    }
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function orderAge(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function BranchOrdersView() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('fatboy-admin-key') ?? '');
  const [role, setRole] = useState<StaffRole>(() => (sessionStorage.getItem(ROLE_STORAGE_KEY) as StaffRole) || 'manager');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(() => sessionStorage.getItem(BRANCH_STORAGE_KEY) ?? '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTab>('active');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canCancel = role === 'manager' || role === 'admin';
  const canFinalize = role !== 'cashier' || true;

  useEffect(() => {
    if (adminKey) {
      validateAndLoad(adminKey);
    } else {
      getBranches().then(setBranches).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(ROLE_STORAGE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (selectedBranchId) sessionStorage.setItem(BRANCH_STORAGE_KEY, selectedBranchId);
  }, [selectedBranchId]);

  async function validateAndLoad(key = adminKey) {
    try {
      setIsLoading(true);
      setError('');

      const [branchList] = await Promise.all([getBranches(), getAdminOrders(key)]);
      setBranches(branchList);
      const savedBranchStillExists = branchList.some((branch) => branch.id === selectedBranchId);
      const nextBranchId = savedBranchStillExists ? selectedBranchId : branchList[0]?.id ?? '';
      setSelectedBranchId(nextBranchId);

      setIsAuthorized(true);
      sessionStorage.setItem('fatboy-admin-key', key);
    } catch (err) {
      setIsAuthorized(false);
      setError(err instanceof Error ? err.message : 'Clave administrativa incorrecta.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOperationData(showSpinner = false) {
    if (!adminKey || !selectedBranchId) return;

    try {
      if (showSpinner) setSyncing(true);
      const [ordersList, redemptionList] = await Promise.all([
        getAdminOrders(adminKey, selectedBranchId),
        getAdminRewardRedemptions(adminKey).catch(() => []),
      ]);

      setOrders(ordersList);
      setRedemptions(redemptionList);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar pedidos.');
    } finally {
      if (showSpinner) setSyncing(false);
    }
  }

  useEffect(() => {
    if (!isAuthorized || !selectedBranchId) return;

    let isMounted = true;
    const tick = async () => {
      if (!isMounted) return;
      await loadOperationData(false);
    };

    tick();
    const intervalId = window.setInterval(tick, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthorized, selectedBranchId, adminKey]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    await validateAndLoad(adminKey);
  }

  async function handleUpdateStatus(order: Order, status: Order['status']) {
    try {
      setIsLoading(true);
      setMessage('');
      setError('');
      const updated = await updateAdminOrderStatus(adminKey, order.id, status);

      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: updated.status } : item)));
      setMessage(`Pedido #${shortOrderId(order.id)} actualizado.`);
      window.setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el pedido.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrint(order: Order) {
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
      setError('El navegador bloqueo la ventana de impresion.');
      return;
    }

    ticket.document.write(`
      <html>
        <head>
          <title>Pedido ${shortOrderId(order.id)}</title>
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
          <h1>FATBOY #${shortOrderId(order.id)}</h1>
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
  }

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const activeOrders = useMemo(() => orders.filter((order) => order.status === 'pending' || order.status === 'preparing' || order.status === 'ready'), [orders]);
  const pendingOrders = useMemo(() => activeOrders.filter((order) => order.status === 'pending'), [activeOrders]);
  const preparingOrders = useMemo(() => activeOrders.filter((order) => order.status === 'preparing'), [activeOrders]);
  const readyOrders = useMemo(() => activeOrders.filter((order) => order.status === 'ready'), [activeOrders]);
  const completedOrders = useMemo(() => orders.filter((order) => order.status === 'delivered' || order.status === 'cancelled'), [orders]);
  const todayTotal = useMemo(
    () => orders.filter((order) => order.status === 'delivered').reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  if (!isAuthorized) {
    return (
      <main className="min-h-[100dvh] bg-[#101010] text-white flex items-center justify-center px-5">
        <form onSubmit={handleUnlock} className="w-full max-w-md rounded-xl border border-white/10 bg-[#181818] p-5 shadow-2xl">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <KeyRound size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Acceso operativo</p>
              <h1 className="font-display text-3xl leading-none">SUCURSALES / PEDIDOS</h1>
              <p className="mt-1 text-xs font-medium leading-relaxed text-gray-400">
                Recepcion, aceptacion, impresion, finalizacion y canjes para el dia a dia.
              </p>
            </div>
          </div>

          <Input
            label="Clave administrativa"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            autoFocus
          />

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(roleConfig) as StaffRole[]).map((roleId) => {
              const Icon = roleConfig[roleId].Icon;
              return (
                <button
                  type="button"
                  key={roleId}
                  onClick={() => setRole(roleId)}
                  className={cn(
                    'rounded-lg border px-2 py-3 text-left transition-colors',
                    role === roleId ? 'border-primary bg-primary/12 text-white' : 'border-white/10 bg-black/20 text-gray-400',
                  )}
                >
                  <Icon size={16} className={role === roleId ? 'text-primary' : 'text-gray-500'} />
                  <span className="mt-2 block text-[11px] font-black uppercase">{roleConfig[roleId].short}</span>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-sm font-semibold text-primary">{error}</p>}
          <Button type="submit" className="mt-5 w-full" isLoading={isLoading}>
            Entrar a Operacion
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#11100f] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#171615]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Store size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-none tracking-wide">CONTROL DE PEDIDOS</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-400">
                <span className="inline-flex items-center gap-1"><BadgeCheck size={13} /> {roleConfig[role].label}</span>
                {selectedBranch && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {selectedBranch.name}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {message && <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-300">{message}</span>}
            {error && <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-black text-primary"><AlertCircle size={14} /> {error}</span>}
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="h-10 rounded-lg border border-white/10 bg-[#101010] px-3 text-xs font-black uppercase text-white outline-none focus:border-primary"
            >
              {(Object.keys(roleConfig) as StaffRole[]).map((roleId) => (
                <option key={roleId} value={roleId}>{roleConfig[roleId].label}</option>
              ))}
            </select>
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-[#101010] px-3 text-xs font-black uppercase text-white outline-none focus:border-primary"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <Button type="button" size="sm" variant="outline" onClick={() => loadOperationData(true)} isLoading={syncing}>
              <RefreshCw size={15} className="mr-1" /> Sync
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 border-b border-white/10 bg-[#151413] px-4 py-3 lg:grid-cols-[1fr_auto] lg:px-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard label="Nuevos" value={pendingOrders.length.toString()} tone="amber" Icon={Bell} />
          <MetricCard label="Preparacion" value={preparingOrders.length.toString()} tone="sky" Icon={ChefHat} />
          <MetricCard label="Listos" value={readyOrders.length.toString()} tone="emerald" Icon={CheckCircle2} />
          <MetricCard label="Venta finalizada" value={currency(todayTotal)} tone="red" Icon={CreditCard} />
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400 lg:w-80">
          <p className="font-black uppercase tracking-[0.18em] text-white">Permisos activos</p>
          <p className="mt-1 leading-snug">{roleConfig[role].description}</p>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#11100f] px-4 py-2 lg:px-6">
        <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} Icon={ShoppingBag}>
          Pedidos activos <span>{activeOrders.length}</span>
        </TabButton>
        <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} Icon={CheckCircle2}>
          Finalizados <span>{completedOrders.length}</span>
        </TabButton>
        <TabButton active={activeTab === 'redemptions'} onClick={() => setActiveTab('redemptions')} Icon={Gift}>
          Canjes <span>{redemptions.length}</span>
        </TabButton>
      </nav>

      {activeTab === 'active' && (
        <section className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-3">
          <OrderColumn title="Recepcion / nuevos" count={pendingOrders.length} tone="amber">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role={role}
                canCancel={canCancel}
                canFinalize={canFinalize}
                onAccept={() => handleUpdateStatus(order, 'preparing')}
                onReady={() => handleUpdateStatus(order, 'ready')}
                onFinalize={() => handleUpdateStatus(order, 'delivered')}
                onCancel={() => handleUpdateStatus(order, 'cancelled')}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Preparacion / entrega" count={preparingOrders.length} tone="sky">
            {preparingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role={role}
                canCancel={canCancel}
                canFinalize={canFinalize}
                onAccept={() => handleUpdateStatus(order, 'preparing')}
                onReady={() => handleUpdateStatus(order, 'ready')}
                onFinalize={() => handleUpdateStatus(order, 'delivered')}
                onCancel={() => handleUpdateStatus(order, 'cancelled')}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Listos para entregar" count={readyOrders.length} tone="emerald">
            {readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role={role}
                canCancel={canCancel}
                canFinalize={canFinalize}
                onAccept={() => handleUpdateStatus(order, 'preparing')}
                onReady={() => handleUpdateStatus(order, 'ready')}
                onFinalize={() => handleUpdateStatus(order, 'delivered')}
                onCancel={() => handleUpdateStatus(order, 'cancelled')}
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
              role={role}
              canCancel={canCancel}
              canFinalize={canFinalize}
              compact
              onAccept={() => handleUpdateStatus(order, 'preparing')}
              onReady={() => handleUpdateStatus(order, 'ready')}
              onFinalize={() => handleUpdateStatus(order, 'delivered')}
              onCancel={() => handleUpdateStatus(order, 'cancelled')}
              onPrint={() => handlePrint(order)}
            />
          ))}
          {completedOrders.length === 0 && <EmptyState icon={CheckCircle2} text="Todavia no hay pedidos finalizados o cancelados en esta sucursal." />}
        </section>
      )}

      {activeTab === 'redemptions' && (
        <section className="grid gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
          {redemptions.map((redemption) => (
            <div key={redemption.id} className="rounded-lg border border-white/10 bg-[#181818] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Canje de producto</p>
                  <h3 className="mt-1 text-base font-black text-white">{redemption.productName}</h3>
                </div>
                <span className="rounded-md border border-gold/25 bg-gold/10 px-2 py-1 text-xs font-black text-gold">
                  {redemption.pointsCost} pts
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-gray-300">
                <span>{redemption.customerName}</span>
                <span className="inline-flex items-center gap-1 text-gray-400"><Phone size={13} /> {redemption.customerPhone || 'Sin telefono'}</span>
                <span className="inline-flex items-center gap-1 text-gray-400"><Clock size={13} /> {new Date(redemption.createdAt).toLocaleString('es-MX')}</span>
              </div>
              <Button type="button" size="sm" className="mt-4 w-full bg-gold text-black hover:bg-gold/90" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" /> Imprimir comprobante
              </Button>
            </div>
          ))}
          {redemptions.length === 0 && <EmptyState icon={Gift} text="No hay canjes recientes registrados." />}
        </section>
      )}
    </main>
  );
}

function MetricCard({ label, value, tone, Icon }: { label: string; value: string; tone: 'amber' | 'sky' | 'emerald' | 'red'; Icon: typeof Bell }) {
  const tones = {
    amber: 'text-amber-300 bg-amber-400/10',
    sky: 'text-sky-300 bg-sky-400/10',
    emerald: 'text-emerald-300 bg-emerald-400/10',
    red: 'text-primary bg-primary/10',
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1918] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-1 text-2xl font-black tracking-tight text-white">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, Icon, children }: { active: boolean; onClick: () => void; Icon: typeof ShoppingBag; children: React.ReactNode }) {
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

function OrderColumn({ title, count, tone, children }: { title: string; count: number; tone: 'amber' | 'sky' | 'emerald'; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col border-r border-white/10">
      <div className={cn('flex items-center justify-between border-b px-4 py-3 lg:px-6', tone === 'amber' && 'border-amber-400/10 bg-amber-400/5', tone === 'sky' && 'border-sky-400/10 bg-sky-400/5', tone === 'emerald' && 'border-emerald-400/10 bg-emerald-400/5')}>
        <h2 className={cn('font-display text-2xl leading-none tracking-wide', tone === 'amber' && 'text-amber-300', tone === 'sky' && 'text-sky-300', tone === 'emerald' && 'text-emerald-300')}>{title}</h2>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-black text-black', tone === 'amber' && 'bg-amber-300', tone === 'sky' && 'bg-sky-300', tone === 'emerald' && 'bg-emerald-300')}>{count}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:p-6">
        {children}
        {count === 0 && <EmptyState icon={Clock} text="Sin pedidos en esta columna." />}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  role,
  canCancel,
  canFinalize,
  compact = false,
  onAccept,
  onReady,
  onFinalize,
  onCancel,
  onPrint,
}: {
  key?: React.Key;
  order: Order;
  role: StaffRole;
  canCancel: boolean;
  canFinalize: boolean;
  compact?: boolean;
  onAccept: () => void;
  onReady: () => void;
  onFinalize: () => void;
  onCancel: () => void;
  onPrint: () => void;
}) {
  const meta = statusMeta[order.status];

  return (
    <article className={cn('rounded-lg border bg-[#1b1a19] p-4 shadow-lg', order.status === 'pending' ? 'border-amber-400/25' : order.status === 'preparing' ? 'border-sky-400/25' : order.status === 'ready' ? 'border-emerald-400/25' : 'border-white/10')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl leading-none tracking-wide">#{shortOrderId(order.id)}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', meta.tone)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {meta.label}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onPrint} className="border-white/10">
          <Printer size={14} className="mr-1" /> Imprimir
        </Button>
        {order.status === 'pending' && (
          <Button type="button" size="sm" onClick={onAccept} className="bg-sky-600 hover:bg-sky-700">
            <ChefHat size={14} className="mr-1" /> Preparar
          </Button>
        )}
        {order.status === 'preparing' && canFinalize && (
          <Button type="button" size="sm" onClick={onReady} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Listo
          </Button>
        )}
        {order.status === 'ready' && canFinalize && (
          <Button type="button" size="sm" onClick={onFinalize} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Entregado
          </Button>
        )}
        {(order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') && canCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel} className="border-primary/25 text-primary hover:bg-primary/10">
            <X size={14} className="mr-1" /> Cancelar
          </Button>
        )}
        {(role === 'cashier' && order.status === 'pending') && (
          <span className="rounded-md border border-white/10 px-2 py-2 text-center text-[10px] font-black uppercase text-gray-500">
            Caja recibe e imprime
          </span>
        )}
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 p-5 text-center text-gray-500">
      <Icon size={34} className="mb-2 text-gray-600" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}
