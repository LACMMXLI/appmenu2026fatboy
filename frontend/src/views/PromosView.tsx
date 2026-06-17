import React, { useEffect, useState } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { getPromotions, resolveMediaUrl, type Product, type Promotion } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface PromosViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

export function PromosView({ onNavigate }: PromosViewProps) {
  const { addItem } = useCart();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPromotions()
      .then((items) => {
        if (mounted) setPromotions(items);
      })
      .catch(() => {
        if (mounted) setPromotions([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const addPromoToCart = (promo: Promotion) => {
    addItem({
      id: promo.id,
      title: promo.title,
      price: promo.price,
      qty: 1,
      img: resolveMediaUrl(promo.imageUrl),
      extras: [],
      removals: [],
      notes: '',
    });
    onNavigate('cart');
  };

  return (
    <div
      className="flex-1 overflow-y-auto no-scrollbar"
      style={{ paddingTop: 36, paddingBottom: 72 }}
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

      <div className="flex flex-col gap-3 px-3 pt-3">
        {promotions.map(promo => (
          <div
            key={promo.id}
            className="rounded-xl overflow-hidden cursor-pointer bg-black"
            style={{ border: '1px solid var(--color-outline)' }}
            onClick={() => addPromoToCart(promo)}
          >
            <img src={resolveMediaUrl(promo.imageUrl)} alt={promo.title} className="w-full object-contain" style={{ aspectRatio: '3 / 2' }} />
            <div
              className="p-2.5 flex items-center justify-between"
              style={{ background: 'var(--color-surface)' }}
            >
              <div>
                <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--color-gold)' }}>{promo.promoText}</p>
                <h3 className="font-black text-[12.5px] text-white mb-0.5">{promo.title}</h3>
                <p className="text-[9.5px] text-[#777] leading-snug">{promo.description}</p>
                <p className="font-bold text-[12px] mt-1" style={{ color: 'var(--color-primary)' }}>${promo.price}.00</p>
              </div>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[9.5px] uppercase tracking-wider flex-shrink-0 ml-3"
                style={{ background: 'var(--color-primary)', color: 'white' }}
                onClick={e => { e.stopPropagation(); addPromoToCart(promo); }}
              >
                <ShoppingCart size={11} /> Agregar
              </button>
            </div>
          </div>
        ))}

        {!isLoading && promotions.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#181818] p-6 text-center">
            <p className="text-xs font-bold text-[#777]">No hay promociones activas en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
