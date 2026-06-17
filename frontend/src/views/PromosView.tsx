import React, { useEffect, useState } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { getPromotions, resolveMediaUrl, type Product, type Promotion } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface PromosViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

const STATIC_PROMOS = [
  {
    id: '7b5d7621-9c2e-4e40-9821-12fb3d2e4101',
    img: '/images/promo_charola_futbolera.png',
    label: 'CHAROLA LA FUTBOLERA',
    desc: 'Boneless, alitas, papas sazonadas, aros de cebolla, palitos de queso, apio, zanahoria y aderezo ranch.',
    price: 380,
  },
  {
    id: '7b5d7621-9c2e-4e40-9821-12fb3d2e4102',
    img: '/images/promo_charola_fatgool.png',
    label: 'CHAROLA FATGOOL',
    desc: 'Hamburguesa guacamole, hamburguesa bacon, burrito de asada, burrito de pastor, boneless, papas, apio, zanahoria, aderezo ranch y bebida.',
    price: 499,
  },
  {
    id: '7b5d7621-9c2e-4e40-9821-12fb3d2e4103',
    img: '/images/promo_rollos_empanizados.png',
    label: '2 ROLLOS CIELO, MAR Y TIERRA EMPANIZADOS',
    desc: '2 rollos empanizados de cielo, mar y tierra. Válido hasta las 10:00 PM.',
    price: 150,
  },
  {
    id: '7b5d7621-9c2e-4e40-9821-12fb3d2e4104',
    img: '/images/promo_rollos_naturales.png',
    label: '2 ROLLOS CIELO, MAR Y TIERRA NATURALES',
    desc: '2 rollos naturales de cielo, mar y tierra. Válido hasta las 10:00 PM.',
    price: 100,
  },
  {
    id: '7b5d7621-9c2e-4e40-9821-12fb3d2e4105',
    img: '/images/promo_urban_fatboy_charola.png',
    label: 'CHAROLA URBAN FATBOY',
    desc: '4 hamburguesas, boneless, papas, apio y zanahoria, pepsi 1.5 L.',
    price: 350,
  },
];

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

  const addStaticPromoToCart = (promo: (typeof STATIC_PROMOS)[number]) => {
    addItem({
      id: promo.id,
      title: promo.label,
      price: promo.price,
      qty: 1,
      img: promo.img,
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
        {promotions.length > 0 && (
          <>
            <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--color-gold)' }}>Especiales publicados hoy</p>
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
          </>
        )}

        <p className="px-1 pt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--color-gold)' }}>Promociones vigentes</p>
        {STATIC_PROMOS.map(promo => (
          <div
            key={promo.id}
            className="rounded-xl overflow-hidden cursor-pointer bg-black"
            style={{ border: '1px solid var(--color-outline)' }}
            onClick={() => addStaticPromoToCart(promo)}
          >
            <img src={promo.img} alt={promo.label} className="w-full object-contain" style={{ aspectRatio: '3 / 2' }} />
            <div
              className="p-2.5 flex items-center justify-between"
              style={{ background: 'var(--color-surface)' }}
            >
              <div>
                <h3 className="font-black text-[12.5px] text-white mb-0.5">{promo.label}</h3>
                <p className="text-[9.5px] text-[#777] leading-snug">{promo.desc}</p>
                <p className="font-bold text-[12px] mt-1" style={{ color: 'var(--color-primary)' }}>${promo.price}.00</p>
              </div>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[9.5px] uppercase tracking-wider flex-shrink-0 ml-3"
                style={{ background: 'var(--color-primary)', color: 'white' }}
                onClick={e => { e.stopPropagation(); addStaticPromoToCart(promo); }}
              >
                <ShoppingCart size={11} /> Agregar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
