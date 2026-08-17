import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  LogOut,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  ShoppingBag,
  Store,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { connectOrdersSocket } from '@/lib/socket';
import {
  ORDER_STATUS_LABELS_ES,
  acceptOrder,
  getAdminRewardRedemptions,
  getBranches,
  getAdminOrders,
  rejectOrder,
  staffLogin,
  staffLogout,
  getStaffMe,
  updateOrderStatus,
  type Branch,
  type Order,
  type OrderStatus,
  type RewardRedemption,
  type Staff,
} from '@/lib/api';

type OrderTab = 'active' | 'completed' | 'redemptions';

const STAFF_TOKEN_KEY = 'fatboy-staff-token';
// Redemptions ("canjes") belong to the loyalty/catalog admin domain, which
// this modernization intentionally does not touch (out of scope) — it keeps
// using the existing shared admin key, entered separately and lazily.
const REDEMPTIONS_ADMIN_KEY = 'fatboy-admin-key';
// Safety net only. Socket.IO is the primary sync mechanism; this just covers
// the rare case where an event was missed and the socket didn't notice.
const SAFETY_POLL_MS = 30_000;

const statusMeta: Record<OrderStatus, { tone: string; dot: string }> = {
  PENDING_APPROVAL: { tone: 'text-amber-300 bg-amber-400/10 border-amber-400/25', dot: 'bg-amber-300' },
  ACCEPTED: { tone: 'text-sky-300 bg-sky-400/10 border-sky-400/25', dot: 'bg-sky-300' },
  PREPARING: { tone: 'text-sky-300 bg-sky-400/10 border-sky-400/25', dot: 'bg-sky-300' },
  READY: { tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', dot: 'bg-emerald-300' },
  COMPLETED: { tone: 'text-green-300 bg-green-400/10 border-green-400/25', dot: 'bg-green-300' },
  REJECTED: { tone: 'text-red-300 bg-red-400/10 border-red-400/25', dot: 'bg-red-300' },
  CANCELLED: { tone: 'text-red-300 bg-red-400/10 border-red-400/25', dot: 'bg-red-300' },
};

function currency(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
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

// Short WebAudio "ping" — no external asset, and browsers only need one user
// gesture (the login submit) before this is allowed to play.
function playNewOrderChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Autoplay/permissions restrictions — silently skip, UI update still happens.
  }
}

export function BranchOrdersView() {
  const [staffToken, setStaffToken] = useState(() => sessionStorage.getItem(STAFF_TOKEN_KEY) ?? '');
  const [staff, setStaff] = useState<Staff | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptionsKey, setRedemptionsKey] = useState(() => sessionStorage.getItem(REDEMPTIONS_ADMIN_KEY) ?? '');
  const [activeTab, setActiveTab] = useState<OrderTab>('active');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const canCancel = staff?.role === 'MANAGER' || staff?.role === 'ADMIN';
  const isAuthorized = Boolean(staff);
  const effectiveBranchId = staff?.role === 'ADMIN' ? selectedBranchId : staff?.branchId ?? '';

  const loadOperationData = useCallback(
    async (showSpinner = false) => {
      if (!staffToken || !effectiveBranchId) return;
      try {
        if (showSpinner) setSyncing(true);
        const result = await getAdminOrders(staffToken, { branchId: effectiveBranchId, limit: 200 });

        // Chime once per newly-seen PENDING_APPROVAL order — never repeat
        // for the same order (VEINTICINCO).
        if (knownOrderIdsRef.current) {
          const freshlyPending = result.items.filter(
            (o) => o.status === 'PENDING_APPROVAL' && !knownOrderIdsRef.current!.has(o.id),
          );
          if (freshlyPending.length > 0) playNewOrderChime();
        }
        knownOrderIdsRef.current = new Set(result.items.map((o) => o.id));

        setOrders(result.items);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al sincronizar pedidos.');
      } finally {
        if (showSpinner) setSyncing(false);
      }
    },
    [staffToken, effectiveBranchId],
  );

  // Login / session restore
  useEffect(() => {
    if (!staffToken) {
      getBranches().then(setBranches).catch(() => undefined);
      return;
    }
    getStaffMe(staffToken)
      .then((s) => {
        setStaff(s);
        if (s.branchId) setSelectedBranchId(s.branchId);
      })
      .catch(() => {
        sessionStorage.removeItem(STAFF_TOKEN_KEY);
        setStaffToken('');
      });
  }, [staffToken]);

  useEffect(() => {
    if (!isAuthorized) return;
    getBranches()
      .then((list) => {
        setBranches(list);
        // ADMIN has no fixed branch — default to the first one so the board
        // actually loads instead of sitting on an empty selection while the
        // <select> visually shows its first <option> regardless of state.
        if (staff?.role === 'ADMIN') {
          setSelectedBranchId((current) => (current && list.some((b) => b.id === current) ? current : list[0]?.id ?? ''));
        }
      })
      .catch(() => undefined);
  }, [isAuthorized, staff?.role]);

  // Real-time sync: Socket.IO is authoritative for "something changed", the
  // REST refetch is authoritative for "what it actually is now" (TRECE/DIECISÉIS/DIECISIETE).
  useEffect(() => {
    if (!staffToken || !effectiveBranchId) return;

    const socket = connectOrdersSocket(staffToken);
    socketRef.current = socket;

    const refetch = () => loadOperationData(false);

    socket.on('connect', () => {
      setSocketConnected(true);
      if (staff?.role === 'ADMIN') {
        socket.emit('branch:watch', { branchId: effectiveBranchId });
      }
      refetch(); // reconnection rule: HTTP re-sync, never trust "no events missed"
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('order.created', refetch);
    socket.on('order.status_changed', refetch);

    const safetyInterval = window.setInterval(refetch, SAFETY_POLL_MS);

    return () => {
      window.clearInterval(safetyInterval);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffToken, effectiveBranchId, staff?.role]);

  useEffect(() => {
    if (isAuthorized && effectiveBranchId) loadOperationData(true);
  }, [isAuthorized, effectiveBranchId, loadOperationData]);

  useEffect(() => {
    if (redemptionsKey) {
      getAdminRewardRedemptions(redemptionsKey).then(setRedemptions).catch(() => undefined);
    }
  }, [redemptionsKey]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      const { token, staff: loggedStaff } = await staffLogin({ username, password });
      sessionStorage.setItem(STAFF_TOKEN_KEY, token);
      setStaffToken(token);
      setStaff(loggedStaff);
      if (loggedStaff.branchId) setSelectedBranchId(loggedStaff.branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (staffToken) await staffLogout(staffToken).catch(() => undefined);
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    setStaffToken('');
    setStaff(null);
    setOrders([]);
  }

  async function withOrderAction(order: Order, action: () => Promise<Order>, successLabel: string) {
    try {
      setIsLoading(true);
      setMessage('');
      setError('');
      const updated = await action();
      setOrders((prev) => prev.map((item) => (item.id === order.id ? updated : item)));
      setMessage(`Pedido ${order.folio}: ${successLabel}`);
      window.setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      // A 409 here means someone else (another tablet) already changed this
      // order — refresh from the DB, the real source of truth (DIECIOCHO).
      setError(err instanceof Error ? err.message : 'Error al actualizar el pedido.');
      loadOperationData(false);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAccept(order: Order) {
    return withOrderAction(order, () => acceptOrder(staffToken, order.id), 'aceptado.');
  }

  function handleAdvance(order: Order, status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>) {
    return withOrderAction(order, () => updateOrderStatus(staffToken, order.id, status), 'actualizado.');
  }

  function openRejectModal(order: Order) {
    setRejectTarget(order);
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    const order = rejectTarget;
    setRejectTarget(null);
    await withOrderAction(order, () => rejectOrder(staffToken, order.id, rejectReason.trim()), 'rechazado.');
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
  }

  const selectedBranch = branches.find((branch) => branch.id === effectiveBranchId);
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'PENDING_APPROVAL'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'READY'), [orders]);
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED' || o.status === 'REJECTED' || o.status === 'CANCELLED'),
    [orders],
  );
  const todayTotal = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED').reduce((sum, o) => sum + o.total, 0),
    [orders],
  );

  if (!isAuthorized) {
    return (
      <main className="min-h-[100dvh] bg-[#101010] text-white flex items-center justify-center px-5">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-xl border border-white/10 bg-[#181818] p-5 shadow-2xl">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <KeyRound size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Acceso operativo</p>
              <h1 className="font-display text-3xl leading-none">SUCURSALES / PEDIDOS</h1>
              <p className="mt-1 text-xs font-medium leading-relaxed text-gray-400">
                Recepcion, aceptacion, impresion y finalizacion — con tu cuenta de personal.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Input label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
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
                <span className="inline-flex items-center gap-1"><BadgeCheck size={13} /> {staff?.name} ({staff?.role})</span>
                {selectedBranch && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {selectedBranch.name}</span>}
                <span className={cn('inline-flex items-center gap-1', socketConnected ? 'text-emerald-400' : 'text-amber-400')}>
                  {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                  {socketConnected ? 'En vivo' : 'Reconectando…'}
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
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-[#101010] px-3 text-xs font-black uppercase text-white outline-none focus:border-primary"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => loadOperationData(true)} isLoading={syncing}>
              <RefreshCw size={15} className="mr-1" /> Sync
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleLogout}>
              <LogOut size={15} className="mr-1" /> Salir
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
      </section>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#11100f] px-4 py-2 lg:px-6">
        <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} Icon={ShoppingBag}>
          Pedidos activos <span>{pendingOrders.length + preparingOrders.length + readyOrders.length}</span>
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
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => openRejectModal(order)}
                onAdvance={(status) => handleAdvance(order, status)}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Preparacion / entrega" count={preparingOrders.length} tone="sky">
            {preparingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => openRejectModal(order)}
                onAdvance={(status) => handleAdvance(order, status)}
                onPrint={() => handlePrint(order)}
              />
            ))}
          </OrderColumn>

          <OrderColumn title="Listos para entregar" count={readyOrders.length} tone="emerald">
            {readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canCancel={canCancel}
                onAccept={() => handleAccept(order)}
                onReject={() => openRejectModal(order)}
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
              onReject={() => openRejectModal(order)}
              onAdvance={(status) => handleAdvance(order, status)}
              onPrint={() => handlePrint(order)}
            />
          ))}
          {completedOrders.length === 0 && <EmptyState icon={CheckCircle2} text="Todavia no hay pedidos finalizados, rechazados o cancelados en esta sucursal." />}
        </section>
      )}

      {activeTab === 'redemptions' && (
        <section className="grid gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
          {!redemptionsKey && (
            <form
              className="rounded-lg border border-white/10 bg-[#181818] p-4 md:col-span-2 xl:col-span-3"
              onSubmit={(e) => {
                e.preventDefault();
                const key = new FormData(e.currentTarget).get('key');
                if (typeof key === 'string' && key) {
                  sessionStorage.setItem(REDEMPTIONS_ADMIN_KEY, key);
                  setRedemptionsKey(key);
                }
              }}
            >
              <p className="mb-2 text-xs font-bold text-gray-400">
                Los canjes de puntos se administran con la clave de catálogo (fuera del alcance de esta actualización de pedidos).
              </p>
              <div className="flex gap-2">
                <Input name="key" type="password" placeholder="Clave administrativa" />
                <Button type="submit">Ver canjes</Button>
              </div>
            </form>
          )}
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
          {redemptionsKey && redemptions.length === 0 && <EmptyState icon={Gift} text="No hay canjes recientes registrados." />}
        </section>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#181818] p-5">
            <h2 className="font-display text-2xl">Rechazar pedido {rejectTarget.folio}</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">El cliente verá este motivo inmediatamente.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej. Producto agotado, sucursal saturada, fuera de horario…"
              className="mt-3 h-24 w-full rounded-lg border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none focus:border-primary"
              autoFocus
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
              <Button type="button" onClick={confirmReject} disabled={!rejectReason.trim()}>Confirmar rechazo</Button>
            </div>
          </div>
        </div>
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
  canCancel,
  compact = false,
  onAccept,
  onReject,
  onAdvance,
  onPrint,
}: {
  key?: React.Key;
  order: Order;
  canCancel: boolean;
  compact?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: (status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>) => void;
  onPrint: () => void;
}) {
  const meta = statusMeta[order.status];
  const canPrint = order.status !== 'PENDING_APPROVAL'; // never print before the branch accepts (VEINTE)

  return (
    <article className={cn('rounded-lg border bg-[#1b1a19] p-4 shadow-lg', order.status === 'PENDING_APPROVAL' ? 'border-amber-400/25' : order.status === 'ACCEPTED' || order.status === 'PREPARING' ? 'border-sky-400/25' : order.status === 'READY' ? 'border-emerald-400/25' : 'border-white/10')}>
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onPrint} disabled={!canPrint} className="border-white/10" title={canPrint ? undefined : 'No se imprime hasta que el pedido sea aceptado.'}>
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
            <ChefHat size={14} className="mr-1" /> Preparar
          </Button>
        )}
        {order.status === 'PREPARING' && (
          <Button type="button" size="sm" onClick={() => onAdvance('READY')} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Listo
          </Button>
        )}
        {order.status === 'READY' && (
          <Button type="button" size="sm" onClick={() => onAdvance('COMPLETED')} className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={14} className="mr-1" /> Entregado
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

function EmptyState({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/15 p-5 text-center text-gray-500">
      <Icon size={34} className="mb-2 text-gray-600" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}
