import { useCallback, useState } from 'react';
import { BadgeCheck, LogOut, MapPin, Store, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useStaffSession } from '@/context/StaffSessionContext';
import { useOrdersSocket } from '@/lib/useOrdersSocket';

// Shell autenticado de la Fase uno: confirma que sesión, resolución de
// sucursal y Socket.IO ya funcionan de punta a punta. El tablero de
// columnas por estado (Sección Siete) llega en la Fase tres, sobre esta
// misma base — aquí no se construye UI operativa todavía.
export function OperationView() {
  const { staff, token, branches, effectiveBranchId, selectedBranchId, setSelectedBranchId, logout } = useStaffSession();
  const [lastSyncSignal, setLastSyncSignal] = useState(0);

  const handleOrderEvent = useCallback(() => {
    // Placeholder para el refetch HTTP real (Fase dos). Por ahora solo
    // deja evidencia de que el evento llegó.
    setLastSyncSignal((n) => n + 1);
  }, []);

  const { connected } = useOrdersSocket(token, effectiveBranchId, staff?.role === 'ADMIN', handleOrderEvent);

  const selectedBranch = branches.find((b) => b.id === effectiveBranchId);

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
            <Button type="button" size="sm" variant="outline" onClick={logout}>
              <LogOut size={15} className="mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Base operativa lista</p>
          <p className="mt-2 text-sm font-semibold text-gray-400">
            Sesión, sucursal y tiempo real ya están conectados al backend existente.
            El tablero de pedidos por estado se agrega en la siguiente fase.
          </p>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Señales de socket recibidas: {lastSyncSignal}
          </p>
        </div>
      </section>
    </main>
  );
}
