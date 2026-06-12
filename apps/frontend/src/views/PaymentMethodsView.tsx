import React, { useState } from 'react';
import { ArrowLeft, CreditCard, Banknote, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PaymentMethodsViewProps {
  onNavigate: (view: any) => void;
}

export function PaymentMethodsView({ onNavigate }: PaymentMethodsViewProps) {
  const [selected, setSelected] = useState(1);

  const methods = [
    { id: 1, type: 'cash', label: 'Efectivo al recibir', icon: Banknote },
    { id: 2, type: 'card', label: 'Tarjeta terminación 4567', icon: CreditCard, brand: 'Visa' },
    { id: 3, type: 'card', label: 'Tarjeta terminación 8910', icon: CreditCard, brand: 'Mastercard' },
  ];

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="px-6 py-4 flex items-center relative h-20 w-full mb-6 animate-fade-in-up stagger-1 border-b border-white/5 z-20">
        <button onClick={() => onNavigate('profile')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <div className="w-full flex flex-col items-center justify-center">
          <span className="font-display text-3xl tracking-wide text-white leading-none drop-shadow-md">MÉTODOS DE PAGO</span>
        </div>
      </header>

      <div className="flex-1 px-5 flex flex-col relative z-10 w-full overflow-y-auto pb-24 no-scrollbar">
        <p className="text-sm text-gray-400 mb-6 animate-fade-in-up stagger-2">Selecciona tu método de pago preferido para agilizar tus pedidos.</p>

        <div className="flex flex-col gap-4 animate-fade-in-up stagger-3">
          {methods.map((method, i) => (
            <label 
              key={method.id} 
              className={cn(
                "bg-surface rounded-2xl p-5 flex items-center gap-4 cursor-pointer border group transition-all duration-300 relative overflow-hidden",
                selected === method.id 
                  ? "border-primary shadow-[0_4px_20px_rgba(229,9,20,0.15)] bg-surface-hover" 
                  : "border-outline hover:border-gray-500 hover:bg-surface-hover hover:-translate-y-0.5"
              )}
              style={{ animationDelay: `${0.1 * (i + 4)}s` }}
            >
              <input 
                type="radio" 
                name="payment" 
                className="sr-only group" 
                checked={selected === method.id}
                onChange={() => setSelected(method.id)}
              />
              
              <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center border border-white/5 relative z-10 group-hover:scale-110 transition-transform">
                <method.icon size={24} className={selected === method.id ? 'text-primary' : 'text-gray-400'} />
              </div>
              
              <div className="flex-1 relative z-10">
                <h3 className={cn("font-semibold text-sm transition-colors", selected === method.id ? 'text-white' : 'text-gray-300 group-hover:text-white')}>{method.label}</h3>
                {method.brand && <span className="text-xs text-gray-500 mt-0.5 block">{method.brand}</span>}
              </div>

              <div className="shrink-0 relative z-10">
                {selected === method.id ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(229,9,20,0.4)] animate-zoom-in">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-600 group-hover:border-gray-400 transition-colors"></div>
                )}
              </div>
              
              {selected === method.id && (
                <div className="absolute inset-0 bg-primary/5 pointer-events-none z-0"></div>
              )}
            </label>
          ))}
        </div>

        <button className="mt-6 flex justify-center items-center gap-2 p-4 border border-dashed border-outline rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-surface-hover transition-all animate-fade-in-up stagger-5 active:scale-95 group">
          <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus size={18} />
          </div>
          <span className="font-semibold text-sm">AGREGAR NUEVA TARJETA</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 bg-background z-20 border-t border-outline">
        <Button size="lg" className="w-full text-[15px] shadow-[0_0_15px_rgba(229,9,20,0.3)] animate-pulse-glow hover:scale-[1.02] active:scale-95 transition-transform" onClick={() => onNavigate('profile')}>
          GUARDAR PREFERENCIA
        </Button>
      </div>
      
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] translate-y-1/2 translate-x-1/3 pointer-events-none z-0"></div>
    </div>
  );
}
