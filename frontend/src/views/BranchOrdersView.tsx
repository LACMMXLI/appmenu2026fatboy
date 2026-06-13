import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Play, Check, X, Store, KeyRound, AlertCircle, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  getAdminOrders,
  updateAdminOrderStatus,
  getBranches,
  type Branch,
  type Order
} from '@/lib/api';

export function BranchOrdersView() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('fatboy-admin-key') ?? '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Cargar sucursales iniciales y validar clave admin
  useEffect(() => {
    if (adminKey) {
      validateAndLoad(adminKey);
    }
  }, []);

  async function validateAndLoad(key = adminKey) {
    try {
      setIsLoading(true);
      setError('');
      
      const list = await getBranches();
      setBranches(list);
      if (list.length > 0) {
        setSelectedBranchId(list[0].id);
      }

      // Validar la clave del administrador haciendo una llamada rápida
      await getAdminOrders(key);
      
      setIsAuthorized(true);
      sessionStorage.setItem('fatboy-admin-key', key);
    } catch (err) {
      setIsAuthorized(false);
      setError(err instanceof Error ? err.message : 'Clave administrativa incorrecta.');
    } finally {
      setIsLoading(false);
    }
  }

  // Polling para cargar pedidos de la sucursal seleccionada
  useEffect(() => {
    if (!isAuthorized || !selectedBranchId) return;

    let isMounted = true;
    let intervalId: any = null;

    async function loadOrders() {
      try {
        const list = await getAdminOrders(adminKey, selectedBranchId);
        if (isMounted) {
          setOrders(list);
          setError('');
        }
      } catch (err) {
        if (isMounted) setError('Error al sincronizar pedidos.');
      }
    }

    loadOrders();
    intervalId = setInterval(loadOrders, 5000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthorized, selectedBranchId, adminKey]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    await validateAndLoad(adminKey);
  }

  async function handleUpdateStatus(orderId: string, status: string) {
    try {
      setIsLoading(true);
      setMessage('');
      setError('');
      await updateAdminOrderStatus(adminKey, orderId, status);
      
      // Actualizar localmente
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as any } : o));
      setMessage('Pedido actualizado.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Error al actualizar el pedido.');
    } finally {
      setIsLoading(false);
    }
  }

  // Filtrar pedidos por estado
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter(o => o.status === 'preparing'), [orders]);

  if (!isAuthorized) {
    return (
      <main className="min-h-[100dvh] bg-background text-white flex items-center justify-center px-5">
        <form onSubmit={handleUnlock} className="w-full max-w-sm rounded-xl border border-outline bg-surface p-5 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <KeyRound size={22} />
            </div>
            <div>
              <h1 className="font-display text-3xl leading-none">COCINA / SUCURSALES</h1>
              <p className="text-xs text-gray-400">Ver y procesar los pedidos de tu sucursal.</p>
            </div>
          </div>
          <Input
            label="Clave administrativa"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoFocus
          />
          {error && <p className="mt-3 text-sm text-primary">{error}</p>}
          <Button type="submit" className="mt-5 w-full" isLoading={isLoading}>
            Entrar a Cocina
          </Button>
        </form>
      </main>
    );
  }

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  return (
    <main className="min-h-[100dvh] bg-[#121212] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-outline bg-surface px-6 py-4 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Store className="text-primary" size={28} />
          <div>
            <h1 className="font-display text-3xl tracking-wide leading-none">PANTALLA DE COCINA</h1>
            <p className="text-xs text-gray-400 mt-1">Gestión operativa para sucursales Fatboy.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {message && <span className="text-sm text-green-400 font-semibold animate-pulse">{message}</span>}
          {error && <span className="text-sm text-primary font-semibold flex items-center gap-1"><AlertCircle size={14} /> {error}</span>}
          
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            SUCURSAL:
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-10 rounded-lg border border-outline bg-background px-3 text-sm font-bold text-white outline-none focus:border-primary"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* columns list */}
      <div className="flex-1 grid md:grid-cols-2 divide-x divide-outline/30 overflow-hidden h-[calc(100vh-80px)]">
        {/* Column 1: PENDIENTES */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="bg-yellow-500/5 px-6 py-3 border-b border-outline/35 flex justify-between items-center shrink-0">
            <span className="font-display text-xl tracking-wider text-yellow-400 font-bold uppercase">NUEVOS PEDIDOS (PENDIENTES)</span>
            <span className="bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">{pendingOrders.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {pendingOrders.map(order => {
              const shortId = order.id.substring(0, 8).toUpperCase();
              const formattedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={order.id} className="bg-surface border-2 border-yellow-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden animate-fade-in-up">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-display text-lg tracking-wider text-white">PEDIDO #{shortId}</span>
                      <span className="text-xs text-gray-400 block flex items-center gap-1 mt-0.5"><Clock size={12} /> {formattedTime}</span>
                    </div>
                    <Button 
                      onClick={() => handleUpdateStatus(order.id, 'preparing')} 
                      className="bg-blue-600 hover:bg-blue-700 font-bold px-4 py-2 text-xs flex gap-1.5 items-center animate-pulse-glow"
                    >
                      <Play size={12} /> Cocinar
                    </Button>
                  </div>

                  <div className="border-t border-outline/20 pt-3 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</span>
                      <p className="font-bold text-white text-sm flex items-center gap-1.5">{order.customerName} <span className="text-xs font-normal text-gray-400">({order.customerPhone})</span></p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Detalle del Pedido</span>
                      <ul className="text-xs text-gray-300 list-disc pl-4 mt-1 space-y-1 font-semibold">
                        {order.items.map((item, idx) => {
                          const extText = item.extras ? ` (Extras: ${JSON.parse(item.extras).map((e: any) => e.name).join(', ')})` : '';
                          const remText = item.removals ? ` (Sin: ${JSON.parse(item.removals).join(', ')})` : '';
                          const prepText = item.meatPrep ? ` [${item.meatPrep}]` : '';
                          return <li key={idx}>{item.quantity}x {item.productName}{prepText}{extText}{remText}</li>;
                        })}
                      </ul>
                    </div>

                    {order.notes && (
                      <div className="bg-yellow-500/5 border border-yellow-500/20 p-2 rounded text-xs text-yellow-400">
                        <strong>Nota:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {pendingOrders.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-gray-500">
                <Check size={48} className="text-gray-600 mb-2" />
                <p className="font-semibold text-sm">Sin pedidos pendientes. ¡Excelente trabajo!</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: EN COCINA */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="bg-blue-500/5 px-6 py-3 border-b border-outline/35 flex justify-between items-center shrink-0">
            <span className="font-display text-xl tracking-wider text-blue-400 font-bold uppercase">EN PREPARACIÓN</span>
            <span className="bg-blue-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">{preparingOrders.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {preparingOrders.map(order => {
              const shortId = order.id.substring(0, 8).toUpperCase();
              const formattedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={order.id} className="bg-surface border border-blue-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden animate-fade-in-up">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-display text-lg tracking-wider text-white">PEDIDO #{shortId}</span>
                      <span className="text-xs text-gray-400 block flex items-center gap-1 mt-0.5"><Clock size={12} /> {formattedTime}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleUpdateStatus(order.id, 'delivered')} 
                        className="bg-green-600 hover:bg-green-700 font-bold px-4 py-2 text-xs flex gap-1.5 items-center animate-pulse-glow"
                      >
                        <Check size={12} /> Entregar
                      </Button>
                      <Button 
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')} 
                        className="border border-primary/30 text-primary hover:bg-primary/10 font-bold px-3 py-2 text-xs"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-outline/20 pt-3 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</span>
                      <p className="font-bold text-white text-sm flex items-center gap-1.5">{order.customerName} <span className="text-xs font-normal text-gray-400">({order.customerPhone})</span></p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Detalle del Pedido</span>
                      <ul className="text-xs text-gray-300 list-disc pl-4 mt-1 space-y-1 font-semibold">
                        {order.items.map((item, idx) => {
                          const extText = item.extras ? ` (Extras: ${JSON.parse(item.extras).map((e: any) => e.name).join(', ')})` : '';
                          const remText = item.removals ? ` (Sin: ${JSON.parse(item.removals).join(', ')})` : '';
                          const prepText = item.meatPrep ? ` [${item.meatPrep}]` : '';
                          return <li key={idx}>{item.quantity}x {item.productName}{prepText}{extText}{remText}</li>;
                        })}
                      </ul>
                    </div>

                    {order.notes && (
                      <div className="bg-blue-500/5 border border-blue-500/20 p-2 rounded text-xs text-blue-400">
                        <strong>Nota:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {preparingOrders.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-gray-500">
                <Clock size={48} className="text-gray-600 mb-2" />
                <p className="font-semibold text-sm">No hay pedidos preparándose en cocina en este momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
