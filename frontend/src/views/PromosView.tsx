import React, { useEffect, useMemo, useState } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { defaultProductImage, getProducts, getPromotions, getSystemSettings, resolveMediaUrl, type Product, type Promotion } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { areMenuPromotionsOpen, formatPromotionHour, resolvePromotionWindowHours } from '@/lib/promotionWindow';

interface PromosViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

// Fallback shown only if the catalog has no products marked as "Es promoción"
// yet, or while that request is still loading — the admin panel is the real
// source of truth for these cards (Producto → Es promoción).
const FALLBACK_DAILY_PROMOS = [
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
  const [dailyPromoProducts, setDailyPromoProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const { startHour, endHour } = useMemo(() => resolvePromotionWindowHours(settings), [settings]);
  const promotionsOpen = useMemo(() => areMenuPromotionsOpen(new Date(), startHour, endHour), [startHour, endHour]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getPromotions(), getProducts(), getSystemSettings()])
      .then(([promoRes, prodRes, settingsRes]) => {
        if (!mounted) return;
        setPromotions(promoRes.status === 'fulfilled' ? promoRes.value : []);
        setDailyPromoProducts(prodRes.status === 'fulfilled' ? prodRes.value.filter((product) => product.isPromotion) : []);
        if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const dailyPromoCards = dailyPromoProducts.length > 0
    ? dailyPromoProducts.map((product) => ({
        id: product.id,
        img: resolveMediaUrl(product.imageUrl) || defaultProductImage,
        label: product.name,
        desc: product.shortDescription || product.description || '',
        price: product.price,
      }))
    : FALLBACK_DAILY_PROMOS;

  const addPromoToCart = (promo: Promotion) => {
    if (!promotionsOpen) return;

    addItem({
      id: promo.id,
      title: promo.title,
      price: promo.price,
      qty: 1,
      img: resolveMediaUrl(promo.imageUrl),
      isPromotion: true,
      extras: [],
      removals: [],
      notes: '',
    });
    onNavigate('cart');
  };

  const addDailyPromoToCart = (promo: (typeof dailyPromoCards)[number]) => {
    if (!promotionsOpen) return;

    addItem({
      id: promo.id,
      title: promo.label,
      price: promo.price,
      qty: 1,
      img: promo.img,
      isPromotion: true,
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
            <p className="px-1 text-[10.5px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--color-gold)' }}>Especiales publicados hoy</p>
            {promotions.map(promo => (
              <div
                key={promo.id}
                className="rounded-2xl overflow-hidden cursor-pointer bg-[#141414] border border-white/10 shadow-lg transition-all active:scale-[0.985] hover:border-primary/40"
                onClick={() => addPromoToCart(promo)}
              >
                <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
                  <img src={resolveMediaUrl(promo.imageUrl)} alt={promo.title} className="w-full h-full object-cover" />
                  {promo.promoText && (
                    <span className="absolute top-2.5 left-2.5 bg-primary/95 text-white font-black text-[9.5px] uppercase tracking-wider px-2.5 py-1 rounded-md shadow-md">
                      {promo.promoText}
                    </span>
                  )}
                </div>
                <div
                  className="p-3.5 flex items-center justify-between gap-3"
                  style={{ background: 'linear-gradient(145deg, #1c1c1c 0%, #131313 100%)' }}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[14px] text-white uppercase tracking-wide leading-snug mb-1">{promo.title}</h3>
                    {promo.description && (
                      <p className="text-[11.5px] text-gray-300 leading-snug line-clamp-2">{promo.description}</p>
                    )}
                    <p className="font-black text-[16px] text-gold mt-1.5">${Number(promo.price).toFixed(2)}</p>
                  </div>
                  <button
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[10.5px] uppercase tracking-wider flex-shrink-0 text-white bg-primary shadow-md hover:bg-primary-hover active:scale-95 transition-all"
                    onClick={e => { e.stopPropagation(); addPromoToCart(promo); }}
                  >
                    <ShoppingCart size={13} /> Agregar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        <p className="px-1 pt-1 text-[10.5px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--color-gold)' }}>
          {promotionsOpen ? 'Promociones del día' : `Promociones disponibles de ${formatPromotionHour(startHour)} a ${formatPromotionHour(endHour)} h`}
        </p>
        {dailyPromoCards.map(promo => (
          <div
            key={promo.id}
            className={`rounded-2xl overflow-hidden bg-[#141414] border border-white/10 shadow-lg transition-all ${promotionsOpen ? 'cursor-pointer active:scale-[0.985] hover:border-primary/40' : 'cursor-not-allowed opacity-45 grayscale'}`}
            onClick={() => addDailyPromoToCart(promo)}
          >
            <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
              <img src={promo.img} alt={promo.label} className="w-full h-full object-cover" />
            </div>
            <div
              className="p-3.5 flex items-center justify-between gap-3"
              style={{ background: 'linear-gradient(145deg, #1c1c1c 0%, #131313 100%)' }}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[14px] text-white uppercase tracking-wide leading-snug mb-1">{promo.label}</h3>
                {promo.desc && (
                  <p className="text-[11.5px] text-gray-300 leading-snug line-clamp-2">{promo.desc}</p>
                )}
                <p className="font-black text-[16px] text-gold mt-1.5">${Number(promo.price).toFixed(2)}</p>
              </div>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[10.5px] uppercase tracking-wider flex-shrink-0 text-white shadow-md transition-all ${promotionsOpen ? 'bg-primary hover:bg-primary-hover active:scale-95' : 'bg-gray-700'}`}
                disabled={!promotionsOpen}
                onClick={e => { e.stopPropagation(); addDailyPromoToCart(promo); }}
              >
                <ShoppingCart size={13} /> {promotionsOpen ? 'Agregar' : 'No disponible'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
