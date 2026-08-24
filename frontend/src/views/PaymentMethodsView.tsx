import React from 'react';
import { ArrowLeft, Banknote, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PaymentMethodsViewProps {
  onNavigate: (view: any) => void;
}

export function PaymentMethodsView({ onNavigate }: PaymentMethodsViewProps) {
  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="px-6 py-4 flex items-center relative h-20 w-full mb-4 animate-fade-in-up stagger-1 border-b border-white/5 z-20">
        <button onClick={() => onNavigate('profile')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <div className="w-full flex flex-col items-center justify-center">
          <span className="font-display text-3xl tracking-wide text-white leading-none drop-shadow-md">MÉTODO DE PAGO</span>
        </div>
      </header>

      <div className="flex-1 px-5 flex flex-col relative z-10 w-full overflow-y-auto pb-24 no-scrollbar">
        <p className="text-xs text-gray-400 mb-5 animate-fade-in-up stagger-2">
          Información sobre la modalidad de pago aceptada en nuestras sucursales y pedidos.
        </p>

        <div className="flex flex-col gap-4 animate-fade-in-up stagger-3">
          <div className="bg-surface rounded-2xl p-5 flex items-center gap-4 border border-primary shadow-[0_4px_20px_rgba(229,9,20,0.15)] relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center border border-white/10 relative z-10">
              <Banknote size={26} className="text-gold" />
            </div>
            
            <div className="flex-1 relative z-10">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Pago en Efectivo</h3>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-white">Activo</span>
              </div>
              <span className="text-xs text-gray-300 mt-1 block leading-snug">
                Pagas al recibir tu pedido a domicilio o al recogerlo en la sucursal.
              </span>
            </div>

            <div className="shrink-0 relative z-10">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(229,9,20,0.4)]">
                <Check size={14} className="text-white" strokeWidth={3} />
              </div>
            </div>
            
            <div className="absolute inset-0 bg-primary/5 pointer-events-none z-0"></div>
          </div>

          <div className="bg-[#181818] rounded-2xl p-4 border border-white/5 flex items-start gap-3 mt-2">
            <Info size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-gray-300 leading-relaxed">
              No guardamos ni solicitamos tarjetas de crédito o débito en esta plataforma. Todos tus pedidos se liquidan directamente en efectivo con el repartidor o en caja.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 bg-background z-20 border-t border-outline">
        <Button size="lg" className="w-full text-[14px] shadow-[0_0_15px_rgba(229,9,20,0.3)] hover:scale-[1.02] active:scale-95 transition-transform" onClick={() => onNavigate('profile')}>
          ENTENDIDO
        </Button>
      </div>
      
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] translate-y-1/2 translate-x-1/3 pointer-events-none z-0"></div>
    </div>
  );
}
