import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, MessageCircle, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { getBranches, createOrder, type Branch } from '@/lib/api';

interface CartViewProps {
  onNavigate: (view: any) => void;
}

export function CartView({ onNavigate }: CartViewProps) {
  const { items, updateQty, removeItem, clearCart } = useCart();
  const { isAuthenticated, customer, token } = useUser();
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  
  const [notes, setNotes] = useState('');
  
  const [redeemPointsChecked, setRedeemPointsChecked] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadBranches() {
      try {
        const response = await getBranches();
        if (!isMounted) return;
        setBranches(response);
        setSelectedBranchId((current) => current || response[0]?.id || '');
      } catch {
        if (isMounted) setBranches([]);
      }
    }

    loadBranches();
    return () => {
      isMounted = false;
    };
  }, []);
  
  const subtotal = items.reduce((acc, item) => {
    let itemTotal = item.price;
    item.extras?.forEach(ext => itemTotal += ext.price);
    return acc + (itemTotal * item.qty);
  }, 0);

  // Discount calculation based on points (1 pt = $1)
  const discount = redeemPointsChecked ? Math.min(subtotal, pointsToRedeem, customer?.points || 0) : 0;
  const total = Math.max(0, subtotal - discount);

  const handleGenerateOrder = async () => {
    if (!selectedBranchId) {
      setError('Por favor selecciona una sucursal.');
      return;
    }

    setError('');
    const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);

    if (!isAuthenticated || !customer || !token) {
      if (!guestName.trim() || !guestPhone.trim()) {
        setError('Por favor ingresa tu nombre y teléfono para el pedido.');
        return;
      }

      setIsLoading(true);
      try {
        // WhatsApp message formatting for Guest
        let text = `*NUEVO PEDIDO (INVITADO) - Fatboy ${selectedBranch?.name || ''}*\n\n`;
        text += `*Cliente:* ${guestName.trim()}\n*Teléfono:* ${guestPhone.trim()}\n\n*Detalles del pedido:*\n`;
        
        items.forEach(item => {
          let itemTotal = item.price;
          item.extras?.forEach(ext => itemTotal += ext.price);
          text += `- ${item.qty}x ${item.title} ($${itemTotal} c/u)\n`;
          if (item.meatPrep) text += `  Término: ${item.meatPrep}\n`;
          if (item.removals?.length) text += `  Sin: ${item.removals.join(', ')}\n`;
          if (item.extras?.length) text += `  Extras: ${item.extras.map(e => e.name).join(', ')}\n`;
          if (item.notes) text += `  Notas: ${item.notes}\n`;
        });
        
        if (notes) {
          text += `\n*Notas generales:* ${notes}\n`;
        }
        text += `\n*TOTAL: $${total}*\n`;
        text += `\n_Pedido enviado directamente por WhatsApp._`;
        
        const destinationPhone = selectedBranch?.phone || '526860000000';
        window.open(`https://wa.me/${destinationPhone}?text=${encodeURIComponent(text)}`, '_blank');
        
        clearCart();
        onNavigate('home');
      } catch (err) {
        setError('Ocurrió un error al procesar el pedido.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        branchId: selectedBranchId,
        deliveryType: 'pickup' as const, // Default pickup
        paymentMethod: 'cash' as const,  // Default cash
        notes: notes || undefined,
        pointsToRedeem: redeemPointsChecked ? pointsToRedeem : undefined,
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          qty: item.qty,
          meatPrep: item.meatPrep || undefined,
          extras: item.extras || undefined,
          removals: item.removals || undefined,
          notes: item.notes || undefined
        }))
      };

      const order = await createOrder(payload, token);
      
      // WhatsApp message formatting
      const shortId = order.id.substring(0, 8).toUpperCase();
      let text = `*NUEVO PEDIDO #${shortId} - Fatboy ${order.branchName}*\n\n`;
      text += `*Cliente:* ${order.customerName}\n*Teléfono:* ${order.customerPhone}\n\n*Detalles del pedido:*\n`;
      
      items.forEach(item => {
        text += `- ${item.qty}x ${item.title}\n`;
        if (item.meatPrep) text += `  Término: ${item.meatPrep}\n`;
        if (item.removals?.length) text += `  Sin: ${item.removals.join(', ')}\n`;
        if (item.extras?.length) text += `  Extras: ${item.extras.map(e => e.name).join(', ')}\n`;
        if (item.notes) text += `  Notas: ${item.notes}\n`;
      });
      
      if (order.pointsRedeemed > 0) {
        text += `\n*Descuento Puntos:* -$${order.pointsRedeemed}\n`;
      }
      text += `\n*TOTAL: $${order.total}*\n`;
      text += `\n_Pedido registrado en el sistema. Estado: Recibido._`;
      
      const destinationPhone = selectedBranch?.phone || '526860000000';
      window.open(`https://wa.me/${destinationPhone}?text=${encodeURIComponent(text)}`, '_blank');
      
      sessionStorage.setItem('fatboy-last-order-id', order.id);
      clearCart();
      onNavigate('order-tracking');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el pedido.');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center pb-24 pt-4 px-5">
        <ShoppingBag size={64} className="text-gray-600 mb-6 animate-fade-in-up stagger-1" />
        <h2 className="font-display text-3xl text-gray-400 mb-2 animate-fade-in-up stagger-2">TU CARRITO ESTÁ VACÍO</h2>
        <p className="text-gray-500 mb-8 animate-fade-in-up stagger-3">¡Agrega algo delicioso!</p>
        <Button size="lg" className="w-[200px] animate-fade-in-up stagger-4" onClick={() => onNavigate('menu')}>
          VER MENÚ
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-[42px] pb-[135px] px-3 no-scrollbar">
        <header className="flex items-center justify-between mb-4 pb-1 border-b border-white/5 animate-fade-in-up stagger-1">
          <button onClick={() => onNavigate('home')} className="p-1.5 -ml-1 text-white hover:bg-surface rounded-full transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="font-display text-2xl mt-0.5 tracking-wide text-primary">CARRITO</span>
          <button onClick={clearCart} className="text-primary text-[10px] font-semibold hover:underline">
            Vaciar carrito
          </button>
        </header>

        {/* Items List */}
        <div className="flex flex-col gap-6 mb-6 w-full min-w-0">
          {items.map((item, i) => {
            let itemTotal = item.price;
            item.extras?.forEach(ext => itemTotal += ext.price);

            return (
              <div key={item.cartId} className="flex w-full min-w-0 gap-3 items-start animate-fade-in-up" style={{ animationDelay: `${0.1 * (i + 2)}s` }}>
                <div className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-xl bg-surface overflow-hidden shrink-0 shadow-md">
                  <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-between py-1 min-h-[72px] sm:min-h-[80px] overflow-hidden">
                  <div className="min-w-0 overflow-hidden">
                    <h3 className="font-bold text-sm leading-tight text-white mb-1 break-words">{item.title}</h3>
                    {item.meatPrep && <p className="text-xs text-gray-400 break-words">{item.meatPrep}</p>}
                    {item.removals && item.removals.length > 0 && <p className="text-xs text-primary break-words">{item.removals.join(', ')}</p>}
                    {item.extras && item.extras.length > 0 && <p className="text-xs text-accent break-words">+{item.extras.map(e => e.name).join(', ')}</p>}
                    <span className="font-display text-xl text-accent tracking-wide block mt-1">${itemTotal}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button onClick={() => removeItem(item.cartId)} className="text-gray-500 hover:text-primary transition-colors p-2 hover:bg-surface rounded-full">
                    <Trash2 size={20} />
                  </button>
                  <div className="flex items-center justify-between border border-outline rounded-full h-9 px-1 w-[80px] bg-surface">
                    <button onClick={() => updateQty(item.cartId, -1)} className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-white">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm text-center w-4 text-white">{item.qty}</span>
                    <button onClick={() => updateQty(item.cartId, 1)} className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-white">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-outline pt-4 mb-6 flex flex-col gap-1.5 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">SUBTOTAL</span>
            <span className="font-display text-xl tracking-wide text-white">${subtotal}</span>
          </div>
          
          {redeemPointsChecked && discount > 0 && (
            <div className="flex justify-between items-end text-primary">
              <span className="text-xs font-bold uppercase tracking-widest">DESCUENTO PUNTOS</span>
              <span className="font-display text-xl tracking-wide">-${discount}</span>
            </div>
          )}
        </div>

        {/* Points Redemption Panel */}
        {isAuthenticated && customer && customer.points > 0 && (
          <div className="w-full mb-6 bg-surface border border-outline/50 p-4 rounded-xl animate-fade-in-up" style={{ animationDelay: '0.55s' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox"
                checked={redeemPointsChecked}
                onChange={(e) => {
                  setRedeemPointsChecked(e.target.checked);
                  setPointsToRedeem(e.target.checked ? Math.min(customer.points, subtotal) : 0);
                }}
                className="w-5 h-5 rounded border border-gray-500 accent-primary"
              />
              <div>
                <span className="text-sm font-semibold text-white">Redimir puntos acumulados</span>
                <span className="text-xs text-accent block">Tienes {customer.points} puntos disponibles (1 pt = $1)</span>
              </div>
            </label>
            
            {redeemPointsChecked && (
              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
                <span className="text-xs text-gray-400 font-bold uppercase">PUNTOS A USAR:</span>
                <div className="flex items-center justify-between border border-outline rounded-xl h-10 px-1 w-[120px] bg-background">
                  <button 
                    onClick={() => setPointsToRedeem(p => Math.max(0, p - 10))} 
                    className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    -10
                  </button>
                  <span className="font-bold text-sm text-center text-white">{pointsToRedeem}</span>
                  <button 
                    onClick={() => setPointsToRedeem(p => Math.min(customer.points, subtotal, p + 10))} 
                    className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    +10
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">NOTAS DEL PEDIDO</h3>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe aquí alguna nota general..." 
            className="w-full bg-surface border border-outline rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary resize-none h-20 transition-all"
          ></textarea>
        </div>

        {/* Branch Selection */}
        <div className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">SUCURSAL DE PREFERENCIA</h3>
          <div className="grid grid-cols-2 gap-3">
            {branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => setSelectedBranchId(branch.id)}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-300",
                  selectedBranchId === branch.id
                    ? "border-primary bg-primary shadow-[0_0_15px_rgba(229,9,20,0.3)] text-white"
                    : "border-outline bg-surface hover:bg-surface-hover text-gray-300 hover:border-gray-500"
                )}
              >
                <span className="font-bold text-center text-xs leading-tight block">Fatboy<br/>{branch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Customer Info Form */}
        <div className="w-full mb-4 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">TUS DATOS</h3>
          {isAuthenticated && customer ? (
            <div className="bg-surface border border-outline/30 rounded-xl p-3 min-w-0">
              <div className="flex min-w-0 justify-between gap-3 items-center py-1.5 border-b border-outline/10">
                <span className="text-gray-400 text-xs shrink-0">Nombre</span>
                <span className="min-w-0 text-right text-xs font-semibold text-white break-words">{customer.name}</span>
              </div>
              <div className="flex min-w-0 justify-between gap-3 items-center py-1.5">
                <span className="text-gray-400 text-xs shrink-0">Teléfono</span>
                <span className="min-w-0 text-right text-xs font-semibold text-white break-words">{customer.phone}</span>
              </div>
            </div>
          ) : (
            <div className="bg-surface/55 border border-white/5 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-4 shadow-lg">
              <div className="flex flex-col gap-0.5 text-center mb-1">
                <span className="text-[9px] font-black tracking-[0.2em] text-primary uppercase">Pedido rápido</span>
                <h4 className="text-xs font-bold text-white uppercase">Comprar como Invitado</h4>
                <p className="text-[10px] text-gray-400 font-medium">Ingresa tus datos para enviar tu pedido por WhatsApp.</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Input
                  label="Nombre Completo"
                  placeholder="Ej. Juan Pérez"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 text-xs h-11"
                />
                <Input
                  label="Teléfono"
                  placeholder="686 123 4567"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 text-xs h-11"
                />
              </div>

              <div className="border-t border-white/5 pt-3 mt-1 flex flex-col items-center">
                <p className="text-[10px] text-gray-400 font-semibold mb-2">¿Quieres acumular puntos?</p>
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => onNavigate('auth')} 
                    className="text-primary text-[11px] font-extrabold hover:underline"
                  >
                    Iniciar sesión
                  </button>
                  <span className="text-gray-600 text-[10px]">•</span>
                  <button 
                    type="button" 
                    onClick={() => onNavigate('register')} 
                    className="text-white text-[11px] font-bold hover:underline"
                  >
                    Crear cuenta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Summary & Action Button */}
      <div className="absolute bottom-0 left-0 w-full px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-[#1a1a1a]/95 backdrop-blur-md border-t border-white/5 z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.6)] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        {error && <p className="text-xs text-primary mb-2 text-center font-bold">{error}</p>}
        
        <div className="flex justify-between items-end mb-2.5 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">TOTAL A PAGAR</span>
          <span className="font-display text-3xl tracking-wide text-accent">${total}</span>
        </div>
        
        <Button 
          size="lg" 
          className="w-full flex items-center justify-between px-6 shadow-[0_0_20px_rgba(229,9,20,0.3)] animate-pulse-glow" 
          onClick={handleGenerateOrder}
          isLoading={isLoading}
        >
          <span className="flex-1 text-center font-bold">GENERAR PEDIDO</span>
          <MessageCircle size={24} className="shrink-0 text-white opacity-70" />
        </Button>
        <p className="text-[10px] text-gray-400 mt-2.5 text-center">Se registrará en el sistema y se notificará por WhatsApp.</p>
      </div>
    </div>
  );
}
