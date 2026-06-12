import React, { useEffect, useState } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { getProducts, defaultProductImage, type Product } from '@/lib/api';

interface PromosViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

const STATIC_PROMOS = [
  { id: 'sp1', img: '/images/promo_banner_combo_fatboy_1781279450113.png',  label: 'COMBO FATBOY',    desc: 'Burger + papas + refresco. El clásico de la casa.' },
  { id: 'sp2', img: '/images/promo_banner_2x1_1781279460341.png',           label: '2X1 EN CLÁSICAS', desc: 'Compra una Fatboy Clásica y la segunda viene gratis.' },
  { id: 'sp3', img: '/images/promo_banner_papas_gratis_1781279470761.png',  label: 'PAPAS GRATIS',    desc: 'Pide cualquier combo y recibe unas papas extra sin costo.' },
];

export function PromosView({ onNavigate }: PromosViewProps) {
  const [promos, setPromos]   = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    getProducts()
      .then(list => { if (m) setPromos(list.filter(p => p.isPromotion)); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);

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
            className="rounded-xl overflow-hidden cursor-pointer"
            style={{ border: '1px solid var(--color-outline)' }}
            onClick={() => onNavigate('menu')}
          >
            <img src={promo.img} alt={promo.label} className="w-full object-cover" style={{ height: 115 }} />
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

        {/* Dynamic promos from backend */}
        {!loading && promos.length > 0 && (
          <>
            <h2
              className="text-[10.5px] font-black uppercase tracking-widest mt-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              MÁS PROMOCIONES
            </h2>
            {promos.map(p => (
              <div
                key={p.id}
                className="rounded-xl overflow-hidden cursor-pointer"
                style={{ border: '1px solid var(--color-outline)' }}
                onClick={() => onNavigate('product-detail', p)}
              >
                <img
                  src={p.imageUrl || defaultProductImage}
                  alt={p.name}
                  className="w-full object-cover"
                  style={{ height: 100 }}
                />
                <div
                  className="p-2.5 flex items-center justify-between"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <div>
                    <h3 className="font-black text-[12.5px] text-white mb-0.5">{p.name}</h3>
                    <p className="font-bold text-[11.5px]" style={{ color: 'var(--color-primary)' }}>
                      ${p.price}.00
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[9.5px] uppercase tracking-wider flex-shrink-0 ml-3"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                    onClick={e => { e.stopPropagation(); onNavigate('product-detail', p); }}
                  >
                    <ShoppingCart size={11} /> Ver
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
