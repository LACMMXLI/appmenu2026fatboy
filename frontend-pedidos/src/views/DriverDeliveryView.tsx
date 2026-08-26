import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useStaffSession } from '@/context/StaffSessionContext';
import {
  completeDelivery,
  listMyDeliveries,
  reportDeliveryIncident,
  startDelivery,
  type DeliveryTask,
} from '@/lib/api';
import { buildGoogleMapsUrl, buildPhoneUrl, buildWhatsAppUrl } from '@/lib/deliveryLinks';
import { currency, orderClockTime } from '@/lib/orderHelpers';
import { useOrdersSocket } from '@/lib/useOrdersSocket';
import { cn } from '@/lib/utils';

const DELIVERY_LABELS = {
  ASSIGNED: 'Asignado',
  EN_ROUTE: 'En camino',
  INCIDENT: 'Incidencia',
  DELIVERED: 'Entregado',
} as const;

export function DriverDeliveryView() {
  const { staff, token, branches, logout } = useStaffSession();
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [incidentDrafts, setIncidentDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setSyncing(true);
    try {
      setTasks(await listMyDeliveries(token));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus entregas.');
    } finally {
      setSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeliveryEvent = useCallback(() => void load(), [load]);
  const { connected } = useOrdersSocket(token, staff?.branchId ?? '', false, handleDeliveryEvent);
  const branch = useMemo(() => branches.find((item) => item.id === staff?.branchId), [branches, staff?.branchId]);

  async function run(task: DeliveryTask, action: () => Promise<DeliveryTask>, success: string) {
    setBusyId(task.id);
    setError('');
    try {
      const updated = await action();
      setTasks((current) => updated.status === 'DELIVERED'
        ? current.filter((item) => item.id !== updated.id)
        : current.map((item) => item.id === updated.id ? updated : item));
      setMessage(success);
      window.setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la entrega.');
      await load();
    } finally {
      setBusyId('');
    }
  }

  async function submitIncident(task: DeliveryTask) {
    const reason = incidentDrafts[task.id]?.trim() ?? '';
    await run(task, () => reportDeliveryIncident(token, task.id, reason), 'Incidencia reportada a la sucursal.');
    setIncidentDrafts((current) => ({ ...current, [task.id]: '' }));
  }

  return (
    <main className="min-h-[100dvh] bg-[#101010] pb-8 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#171615]/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300"><Bike size={21} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Ruta de reparto</p>
              <h1 className="truncate font-display text-2xl leading-none tracking-wide">{staff?.name}</h1>
              <p className="mt-1 truncate text-[11px] font-bold text-gray-500">{branch?.name ?? 'Sucursal'} · {connected ? 'En línea' : 'Reconectando'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} isLoading={syncing} aria-label="Actualizar entregas" className="w-10 px-0">
              <RefreshCw size={16} />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logout} aria-label="Cerrar sesión" className="w-10 px-0">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-4 px-3 pt-4 sm:px-4">
        {(message || error) && (
          <div className={cn('rounded-lg border px-4 py-3 text-sm font-bold', error ? 'border-red-400/25 bg-red-400/10 text-red-200' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200')}>
            {error || message}
          </div>
        )}

        {!syncing && tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#181818] px-6 py-16 text-center">
            <CheckCircle2 size={38} className="mx-auto text-emerald-400" />
            <h2 className="mt-4 font-display text-3xl tracking-wide">SIN ENTREGAS PENDIENTES</h2>
            <p className="mt-2 text-sm font-semibold text-gray-500">Los pedidos nuevos aparecerán aquí al ser asignados por la sucursal.</p>
          </div>
        )}

        {tasks.map((task, index) => {
          const order = task.order;
          const isBusy = busyId === task.id;
          return (
            <article key={task.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#181818] shadow-2xl shadow-black/20">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Entrega {index + 1} de {tasks.length}</p>
                  <h2 className="mt-1 font-display text-4xl leading-none tracking-wide">{order.folio}</h2>
                </div>
                <span className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide',
                  task.status === 'INCIDENT' ? 'border-red-400/30 bg-red-400/10 text-red-300'
                    : task.status === 'EN_ROUTE' ? 'border-sky-400/30 bg-sky-400/10 text-sky-300'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-300',
                )}>{DELIVERY_LABELS[task.status]}</span>
              </div>

              <div className="grid grid-cols-3 border-b border-white/10 bg-black/15 px-4 py-3">
                {['Asignado', 'En camino', 'Entregado'].map((label, step) => {
                  const currentStep = task.status === 'ASSIGNED' ? 0 : task.status === 'DELIVERED' ? 2 : 1;
                  return (
                    <div key={label} className="flex items-center">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black', step <= currentStep ? 'border-sky-300 bg-sky-300 text-black' : 'border-white/15 text-gray-600')}>{step + 1}</span>
                      <span className={cn('ml-2 hidden text-[10px] font-black uppercase sm:inline', step <= currentStep ? 'text-gray-200' : 'text-gray-600')}>{label}</span>
                      {step < 2 && <span className={cn('mx-2 h-px flex-1', step < currentStep ? 'bg-sky-300' : 'bg-white/10')} />}
                    </div>
                  );
                })}
              </div>

              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Destino</p>
                <div className="mt-2 flex items-start gap-3">
                  <MapPin size={22} className="mt-1 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xl font-black leading-snug text-white">{order.deliveryAddress}</p>
                    {order.deliveryReference && <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-400">Referencia: {order.deliveryReference}</p>}
                  </div>
                </div>

                <a href={buildGoogleMapsUrl(order.deliveryAddress ?? '')} target="_blank" rel="noreferrer" className="mt-4 flex min-h-14 w-full items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-white">
                  <Navigation size={19} className="mr-2" /> Abrir ruta en Google Maps
                </a>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={buildPhoneUrl(order.customerPhone)} className="flex min-h-12 items-center justify-center rounded-lg border border-white/10 bg-[#11100f] text-xs font-black text-gray-200 hover:border-sky-400/40 hover:text-sky-300"><Phone size={16} className="mr-1.5" /> Cliente</a>
                  <a href={buildWhatsAppUrl(order.customerPhone)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-lg border border-white/10 bg-[#11100f] text-xs font-black text-gray-200 hover:border-emerald-400/40 hover:text-emerald-300"><MessageCircle size={16} className="mr-1.5" /> WhatsApp</a>
                  {branch?.phone ? (
                    <a href={buildPhoneUrl(branch.phone)} className="flex min-h-12 items-center justify-center rounded-lg border border-white/10 bg-[#11100f] text-xs font-black text-gray-200 hover:border-amber-400/40 hover:text-amber-300"><Store size={16} className="mr-1.5" /> Sucursal</a>
                  ) : <span className="flex min-h-12 items-center justify-center rounded-lg border border-white/5 text-xs font-black text-gray-600"><Store size={16} className="mr-1.5" /> Sucursal</span>}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                  <div><p className="text-[10px] font-black uppercase text-gray-600">Cliente</p><p className="mt-1 font-bold">{order.customerName}</p></div>
                  <div><p className="text-[10px] font-black uppercase text-gray-600">Total</p><p className="mt-1 text-lg font-black text-emerald-300">{currency(order.total)}</p></div>
                  <div><p className="text-[10px] font-black uppercase text-gray-600">Pago</p><p className="mt-1 font-bold">{order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</p></div>
                  <div><p className="text-[10px] font-black uppercase text-gray-600">Pedido listo</p><p className="mt-1 flex items-center gap-1 font-bold"><Clock3 size={13} /> {orderClockTime(order.createdAt)}</p></div>
                </div>

                {task.status === 'INCIDENT' && task.incidentReason && (
                  <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm font-semibold text-red-200">
                    <AlertTriangle size={16} className="mr-2 inline" /> {task.incidentReason}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {(task.status === 'ASSIGNED' || task.status === 'INCIDENT') && (
                    <Button type="button" size="lg" className="w-full bg-sky-600 hover:bg-sky-700" isLoading={isBusy} onClick={() => void run(task, () => startDelivery(token, task.id), 'Ruta iniciada.')}>
                      <Bike size={18} className="mr-2" /> Marcar en camino
                    </Button>
                  )}
                  {task.status === 'EN_ROUTE' && (
                    <Button type="button" size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700" isLoading={isBusy} onClick={() => {
                      if (window.confirm(`¿Confirmas que entregaste el pedido ${order.folio}?`)) {
                        void run(task, () => completeDelivery(token, task.id), 'Entrega finalizada correctamente.');
                      }
                    }}>
                      <CheckCircle2 size={18} className="mr-2" /> Finalizar entrega
                    </Button>
                  )}

                  <details className="rounded-lg border border-white/10 bg-black/15 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase text-red-300">Reportar un problema</summary>
                    <textarea value={incidentDrafts[task.id] ?? ''} onChange={(event) => setIncidentDrafts((current) => ({ ...current, [task.id]: event.target.value }))} maxLength={300} rows={3} placeholder="Ej. cliente no responde, dirección incorrecta…" className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none focus:border-red-400" />
                    <Button type="button" size="sm" variant="outline" className="mt-2 w-full border-red-400/30 text-red-300 hover:bg-red-400/10" disabled={(incidentDrafts[task.id]?.trim().length ?? 0) < 3} isLoading={isBusy} onClick={() => void submitIncident(task)}>
                      <AlertTriangle size={15} className="mr-2" /> Enviar incidencia
                    </Button>
                  </details>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
