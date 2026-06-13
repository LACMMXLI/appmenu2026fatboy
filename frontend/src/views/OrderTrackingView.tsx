import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, X, Store, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrder, type Order } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface OrderTrackingProps {
  onNavigate: (view: any) => void;
}

export function OrderTrackingView({ onNavigate }: OrderTrackingProps) {
  const [orderId, setOrderId] = useState<string | null>(() => sessionStorage.getItem('fatboy-last-order-id'));
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId: any = null;

    async function fetchOrder() {
      try {
        const data = await getOrder(orderId!);
        if (!isMounted) return;
        setOrder(data);
        setError('');
      } catch (err) {
        if (isMounted) setError('No se pudo cargar el estado del pedido.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOrder();

    // Polling cada 5 segundos
    intervalId = setInterval(fetchOrder, 5000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId]);

  if (!orderId) {
    return (
      <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative justify-center items-center px-6">
        <AlertCircle size={48} className="text-gray-500 mb-4" />
        <h2 className="font-display text-2xl text-gray-400 mb-2">SIN PEDIDO ACTIVO</h2>
        <p className="text-gray-500 text-sm text-center mb-6">No tienes ningún pedido reciente en seguimiento.</p>
        <Button onClick={() => onNavigate('menu')}>IR AL MENÚ</Button>
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative justify-center items-center">
        <span className="font-display text-xl text-gray-400 animate-pulse">CARGANDO PEDIDO...</span>
      </div>
    );
  }

  // Map order status to steps
  // Status: pending, preparing, delivered, cancelled
  const orderStatus = order?.status || 'pending';

  const steps = [
    {
      title: 'RECIBIDO',
      desc: 'Tu pedido ha sido recibido en el sistema',
      status: orderStatus === 'cancelled'
        ? 'pending'
        : (orderStatus === 'pending' ? 'current' : 'done'),
    },
    {
      title: 'EN PREPARACIÓN',
      desc: 'Nuestros cocineros están preparando tu hamburguesa',
      status: orderStatus === 'cancelled'
        ? 'pending'
        : (orderStatus === 'preparing' ? 'current' : (orderStatus === 'delivered' ? 'done' : 'pending')),
    },
    {
      title: 'LISTO / ENTREGADO',
      desc: '¡Tu pedido fue entregado, que disfrutes!',
      status: orderStatus === 'delivered' ? 'done' : 'pending',
    },
  ];

  const formattedTime = order ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const shortId = orderId.substring(0, 8).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative justify-between overflow-hidden">
      <div className="flex flex-col flex-1 w-full relative z-10 pt-4 overflow-y-auto pb-6 no-scrollbar">
        <header className="px-6 py-4 flex items-center relative h-20 w-full mb-6 border-b border-white/5">
          <button onClick={() => onNavigate('home')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface active:scale-95">
            <ArrowLeft size={24} />
          </button>
          <div className="w-full flex flex-col items-center justify-center">
            <span className="font-display text-3xl tracking-wide text-white leading-none drop-shadow-md">SEGUIMIENTO</span>
            <span className="text-xs text-primary font-bold tracking-wider mt-1 drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]">
              Pedido #{shortId}
            </span>
          </div>
        </header>

        {error && <p className="text-xs text-primary text-center px-6 mb-4">{error}</p>}

        {orderStatus === 'cancelled' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center -mt-10">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <X size={32} className="text-primary" />
            </div>
            <h3 className="font-display text-3xl text-white mb-2">PEDIDO CANCELADO</h3>
            <p className="text-sm text-gray-400">Este pedido ha sido cancelado por la sucursal. Comunícate con ellos para más información.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col px-8 relative animate-fade-in-up">
            <div className="absolute left-[47px] top-4 bottom-10 w-[2px] bg-outline z-0"></div>
            <div 
              className={cn(
                "absolute left-[47px] top-4 w-[2px] bg-primary z-0 shadow-[0_0_15px_rgba(229,9,20,0.5)] transition-all duration-700",
                orderStatus === 'pending' ? 'bottom-[75%]' : (orderStatus === 'preparing' ? 'bottom-[35%]' : 'bottom-10')
              )}
            ></div>
            
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6 mb-12 relative z-10 w-full animate-fade-in-up" style={{ animationDelay: `${0.1 * (i + 1)}s` }}>
                <div className="shrink-0 mt-1 relative">
                   {step.status === 'done' && (
                     <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.4)] relative z-10">
                       <Check size={20} className="text-white" strokeWidth={3} />
                     </div>
                   )}
                   {step.status === 'current' && (
                     <div className="w-10 h-10 rounded-full border-2 border-accent bg-background flex items-center justify-center relative z-10 shadow-[0_0_15px_rgba(250,189,0,0.3)] animate-pulse-glow">
                        <X size={20} className="text-accent rotate-45" strokeWidth={2.5}/>
                     </div>
                   )}
                   {step.status === 'pending' && (
                     <div className="w-10 h-10 rounded-full border-2 border-outline bg-background flex items-center justify-center relative z-10">
                     </div>
                   )}
                </div>
                
                <div className="flex-1 pt-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={cn("font-display text-2xl tracking-wide", step.status === 'pending' ? 'text-gray-500' : 'text-white')}>
                      {step.title}
                    </h3>
                    {i === 0 && <span className="text-xs font-semibold text-gray-400">{formattedTime}</span>}
                  </div>
                  <p className={cn("text-sm", step.status === 'pending' ? 'text-gray-600' : step.status === 'current' ? 'text-accent' : 'text-gray-400')}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {order && (
        <div className="px-6 pb-12 w-full animate-fade-in-up relative z-20">
          <div className="bg-surface border border-outline rounded-2xl p-6 flex justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">SUCURSAL</span>
              <span className="font-bold text-white text-[15px] flex items-center gap-2"><Store size={16} /> Fatboy {order.branchName}</span>
            </div>
            <div className="w-[1px] bg-outline h-full self-stretch"></div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">TOTAL</span>
              <span className="font-bold text-accent text-[15px]">${order.total}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none z-0"></div>
    </div>
  );
}
