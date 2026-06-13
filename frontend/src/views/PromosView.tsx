import React from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { type Product } from '@/lib/api';

interface PromosViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

const STATIC_PROMOS = [
  { id: 'charola-futbolera', img: '/images/promo_charola_futbolera.png', label: 'CHAROLA LA FUTBOLERA', desc: 'La mejor botana para ver los partidos.' },
];

export function PromosView({ onNavigate }: PromosViewProps) {
  return (
    <div
      className="flex-1 overflow-y-auto no-scrollbar"
      style={{ paddingTop: 36, paddingBottom: 38 }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-1.5"
        style={{ borderBottom: '1px solid var(--color-outline)' }}
      >
        <Zap size={14} className="text-gold" fill="currentColor" style={{ color: 'var(--color-gold)' }} />
        <h1 className="font-display text-lg tracking-widest" style={{ letterSpacing: '.06em' }}>PROMOS DEL DÍA</h1>
        <Zap size={14} className="text-gold" fill="currentColor" style={{ color: 'var(--color-gold)' }} />
      </div>

      {/* Static promo banner cards — full width */}
      <div className="flex flex-col gap-3 px-3 pt-3">
        {STATIC_PROMOS.map(promo => (
          <div
            key={promo.id}
            className="rounded-xl overflow-hidden cursor-pointer bg-black"
            style={{ border: '1px solid var(--color-outline)' }}
            onClick={() => onNavigate('menu')}
          >
            <img src={promo.img} alt={promo.label} className="w-full object-contain" style={{ aspectRatio: '3 / 2' }} />
            <div
              className="p-2.5 flex items-center justify-between"
              style={{ background: 'var(--color-surface)' }}
            >
              <div>
                <h3 className="font-black text-[12.5px] text-white mb-0.5">{promo.label}</h3>
                <p className="text-[9.5px] text-[#777] leading-snug">{promo.desc}</p>
              </div>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[9.5px] uppercase tracking-wider flex-shrink-0 ml-3"
                style={{ background: 'var(--color-primary)', color: 'white' }}
                onClick={e => { e.stopPropagation(); onNavigate('menu'); }}
              >
                <ShoppingCart size={11} /> Pedir
              </button>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
