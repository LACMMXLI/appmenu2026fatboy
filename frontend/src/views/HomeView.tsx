import React, { useEffect, useMemo, useState } from 'react';
import {
  CakeSlice,
  ChevronRight,
  Cookie,
  CupSoda,
  Drumstick,
  Fish,
  Flame,
  GlassWater,
  Hamburger,
  IceCream,
  MapPin,
  Package,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import {
  getCategories, getProducts, getSystemSettings,
  defaultProductImage,
  getPromotions,
  resolveMediaUrl,
  type HomeBanner, type Category, type Product, type Promotion,
} from '@/lib/api';


interface HomeViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

/* ── Static fallback data ─────────────────────── */
const FALLBACK_BANNERS: HomeBanner[] = [
  {
    id: 'promo-futbolera',
    imageUrl: '/images/promo_charola_futbolera.png',
    title: null,
    subtitle: null,
    buttonText: null,
    linkView: 'promos',
    order: 0,
  },
  {
    id: 'promo-fatgool',
    imageUrl: '/images/promo_charola_fatgool.png',
    title: null,
    subtitle: null,
    buttonText: null,
    linkView: 'promos',
    order: 1,
  },
];

type CategoryVisual = {
  Icon: typeof UtensilsCrossed;
  accent: string;
  bg: string;
};

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  hamburguesa: { Icon: Hamburger, accent: '#ff3f3f', bg: 'rgba(232,0,10,0.16)' },
  burger: { Icon: Hamburger, accent: '#ff3f3f', bg: 'rgba(232,0,10,0.16)' },
  combo: { Icon: Package, accent: '#fabd00', bg: 'rgba(250,189,0,0.16)' },
  charola: { Icon: UtensilsCrossed, accent: '#fabd00', bg: 'rgba(250,189,0,0.16)' },
  dog: { Icon: Sandwich, accent: '#ff8a2a', bg: 'rgba(255,138,42,0.16)' },
  hot: { Icon: Sandwich, accent: '#ff8a2a', bg: 'rgba(255,138,42,0.16)' },
  burrito: { Icon: Drumstick, accent: '#fb923c', bg: 'rgba(251,146,60,0.16)' },
  mexican: { Icon: Flame, accent: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
  sushi: { Icon: Fish, accent: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
  rollo: { Icon: Fish, accent: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
  torta: { Icon: Sandwich, accent: '#f59e0b', bg: 'rgba(245,158,11,0.16)' },
  teriyaki: { Icon: Soup, accent: '#c084fc', bg: 'rgba(192,132,252,0.16)' },
  ensalada: { Icon: Salad, accent: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  extra: { Icon: Popcorn, accent: '#facc15', bg: 'rgba(250,204,21,0.16)' },
  pap: { Icon: Popcorn, accent: '#facc15', bg: 'rgba(250,204,21,0.16)' },
  snack: { Icon: Popcorn, accent: '#facc15', bg: 'rgba(250,204,21,0.16)' },
  nacho: { Icon: Popcorn, accent: '#facc15', bg: 'rgba(250,204,21,0.16)' },
  bebida: { Icon: CupSoda, accent: '#60a5fa', bg: 'rgba(96,165,250,0.16)' },
  drink: { Icon: GlassWater, accent: '#60a5fa', bg: 'rgba(96,165,250,0.16)' },
  postre: { Icon: CakeSlice, accent: '#f472b6', bg: 'rgba(244,114,182,0.16)' },
  dessert: { Icon: IceCream, accent: '#f472b6', bg: 'rgba(244,114,182,0.16)' },
  dulce: { Icon: Cookie, accent: '#f97316', bg: 'rgba(249,115,22,0.16)' },
};

function getCategoryVisual(name: string): CategoryVisual {
  const n = name.toLowerCase();
  for (const [key, visual] of Object.entries(CATEGORY_VISUALS)) {
    if (n.includes(key)) return visual;
  }
  return { Icon: UtensilsCrossed, accent: '#fabd00', bg: 'rgba(250,189,0,0.14)' };
}

const FALLBACK_PRODUCTS = [
  { id: 'fp1', name: 'FATBOY CLÁSICA',  price: 139, description: 'Doble carne smash, queso americano, lechuga, tomate, cebolla, pepinillos y nuestra salsa Fatboy.', imageUrl: '/images/product_fatboy_clasica_1781279420825.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const, imageUrl: null } },
  { id: 'fp2', name: 'FATBOY BACON',    price: 159, description: 'Doble carne smash, queso americano, bacon crujiente, cebolla caramelizada y salsa Fatboy.', imageUrl: '/images/product_fatboy_bacon_1781279428950.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const, imageUrl: null } },
  { id: 'fp3', name: 'FATBOY MUSHROOM', price: 155, description: 'Doble carne smash, queso suizo, champiñones salteados, cebolla caramelizada y aioli de ajo.', imageUrl: '/images/product_fatboy_mushroom_1781279439261.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const, imageUrl: null } },
];

/* ─────────────────────────────────────────────────
   HERO SLIDER
───────────────────────────────────────────────── */
function HeroSlider({ banners, onNavigate }: { banners: HomeBanner[], onNavigate: (v: any) => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const b = banners[idx];
  const isImageOnly = !b.title && !b.subtitle && !b.buttonText;

  return (
    <div className="relative w-full overflow-hidden bg-black" style={isImageOnly ? { aspectRatio: '3 / 2' } : { height: 120 }}>
      {/* background image */}
      <img
        key={b.id}
        src={b.imageUrl}
        alt={b.title || 'Banner'}
        className={cn(
          "absolute top-0 h-full animate-fade-in",
          isImageOnly ? "object-contain" : "object-cover",
          isImageOnly ? "left-0 w-full" : "right-0 w-1/2"
        )}
        style={{ objectPosition: 'center' }}
      />

      {/* Dark overlay left side */}
      {!isImageOnly && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(10,10,10,0.95) 30%, rgba(10,10,10,0.5) 60%, rgba(10,10,10,0) 100%)' }}
        />
      )}

      {/* Content */}
      {!isImageOnly && <div className="absolute inset-0 flex flex-col justify-center px-3 z-10">
        {/* Title */}
        <div className="mb-1">
          <h1
            className="font-sans font-black leading-[1] text-white uppercase whitespace-pre-line"
            style={{ fontSize: 'clamp(1.0rem, 5.5vw, 1.4rem)', textShadow: '0 1.5px 6px rgba(0,0,0,0.8)' }}
          >
            {/* First word white, rest red (split by \n) */}
            {b.title?.split('\n').map((line, li) => (
              <span key={li} style={{ display: 'block', color: li === 0 ? 'white' : 'var(--color-primary)' }}>
                {line}
              </span>
            ))}
          </h1>
        </div>

        {b.subtitle && (
          <p className="text-white/80 text-[9px] font-medium mb-2 leading-snug max-w-[55%]">
            {b.subtitle}
          </p>
        )}

        {/* CTA */}
        <div>
          <button
            className="cta-brush"
            onClick={() => onNavigate(b.linkView ?? 'menu')}
          >
            {b.buttonText || 'VER MENÚ'} <ChevronRight size={11} strokeWidth={3} />
          </button>
        </div>
      </div>}

      {/* Slide dots */}
      {banners.length > 1 && (
        <div className="hero-slide-dots">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn('hero-dot', i === idx && 'active')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionHeroSlider({ promotions, onPromoClick }: { promotions: Promotion[]; onPromoClick: (promotion: Promotion) => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % promotions.length), 5000);
    return () => clearInterval(t);
  }, [promotions.length]);

  if (promotions.length === 0) return null;

  const promotion = promotions[idx] ?? promotions[0];

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '3 / 2' }}>
      <button type="button" className="block h-full w-full text-left" onClick={() => onPromoClick(promotion)}>
        <img src={resolveMediaUrl(promotion.imageUrl)} alt={promotion.title} className="h-full w-full object-contain animate-fade-in" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold">{promotion.promoText}</p>
          <h1 className="mt-1 text-lg font-black uppercase leading-none text-white">{promotion.title}</h1>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-xs font-medium text-white/75">{promotion.description}</p>
            <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-black text-white">
              ${Number(promotion.price).toFixed(2)}
            </span>
          </div>
        </div>
      </button>

      {promotions.length > 1 && (
        <div className="hero-slide-dots">
          {promotions.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={cn('hero-dot', i === idx && 'active')} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN HOME VIEW
───────────────────────────────────────────────── */
export function HomeView({ onNavigate }: HomeViewProps) {
  const { addItem } = useCart();
  const [banners, setBanners]     = useState<HomeBanner[]>(FALLBACK_BANNERS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [settings, setSettings]     = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let m = true;
    Promise.allSettled([getCategories(), getSystemSettings(), getPromotions()])
      .then(([cRes, sRes, pRes]) => {
        if (!m) return;
        if (cRes.status === 'fulfilled') setCategories(cRes.value);
        if (sRes.status === 'fulfilled') setSettings(sRes.value);
        if (pRes.status === 'fulfilled') setPromotions(pRes.value);
      })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
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
    <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingTop: 44, paddingBottom: 60 }}>

      {/* ── HERO SLIDER ──────────────────────────── */}
      {promotions.length > 0 ? (
        <PromotionHeroSlider promotions={promotions} onPromoClick={addPromoToCart} />
      ) : (
        <HeroSlider banners={banners} onNavigate={onNavigate} />
      )}

      {/* ── CATEGORY SHORTCUTS ───────────────────── */}
      <div className="px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/85">Categorías</h2>
        </div>

        <div className="grid auto-cols-[64px] grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => {
            const visual = getCategoryVisual(cat.name);
            const Icon = visual.Icon;

            return (
              <button
                key={cat.id}
                type="button"
                className="group flex h-[54px] w-[64px] flex-col items-center justify-center gap-1 rounded-lg border border-white/8 bg-[#181818] px-1 text-center shadow-[0_5px_12px_rgba(0,0,0,0.18)] transition-all active:scale-[0.97]"
                onClick={() => onNavigate('menu', cat.id)}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 transition-transform group-active:scale-95"
                  style={{ background: visual.bg, color: visual.accent, boxShadow: `0 0 12px ${visual.bg}` }}
                >
                  <Icon size={16} strokeWidth={2.5} />
                </span>
                <span className="line-clamp-2 max-w-full text-[7.5px] font-black uppercase leading-[1.02] tracking-[0.02em] text-white/85">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PROMOS DEL DÍA ───────────────────────── */}
      {promotions.length > 0 && <div>
        <div className="section-heading">
          <h2 className="section-title">
            <Zap size={13} className="text-gold" fill="currentColor" style={{ color: 'var(--color-gold)' }} />
            PROMOS DEL DÍA
            <Zap size={13} className="text-gold" fill="currentColor" style={{ color: 'var(--color-gold)' }} />
          </h2>
          <button className="section-link" onClick={() => onNavigate('promos')}>
            VER TODAS <ChevronRight size={11} strokeWidth={2.5} />
          </button>
        </div>

        <div className="promos-container no-scrollbar">
          {promotions.map(promo => (
            <div
              key={promo.id}
              className="promo-card bg-black"
              onClick={() => addPromoToCart(promo)}
            >
              <img src={resolveMediaUrl(promo.imageUrl)} alt={promo.title} className="w-full h-full object-contain rounded-[10px] bg-black" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  addPromoToCart(promo);
                }}
                className="absolute bottom-2 right-2 rounded-md bg-primary px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(229,9,20,0.45)]"
              >
                Agregar ${promo.price}
              </button>
            </div>
          ))}
        </div>
      </div>}

      {/* ── UBICACIONES Y REDES SOCIALES ───────────────────────── */}
      <div className="px-3 mt-4 mb-2 space-y-2.5">
        {/* Botón de Ubicaciones */}
        <button
          onClick={() => onNavigate('branches')}
          className="w-full h-10 bg-primary text-white font-sans font-bold uppercase rounded-lg flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all border border-primary/20 shadow-[0_0_10px_rgba(229,9,20,0.15)]"
          style={{ fontSize: '11px' }}
        >
          <MapPin size={15} className="text-gold" style={{ color: 'var(--color-gold)' }} />
          Ver Nuestras Ubicaciones
        </button>

        {/* Botones de Redes Sociales / WhatsApp */}
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href="https://wa.me/526861105191"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 bg-[#25D366]/10 border border-[#25D366]/30 hover:border-[#25D366] rounded-lg flex items-center justify-center gap-2 text-white/90 hover:text-white font-sans text-[10px] font-bold uppercase transition-all"
          >
            <svg className="w-4 h-4 fill-current text-[#25D366]" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-3.535l.409.243c1.517.901 3.23 1.378 4.978 1.379 5.485 0 9.95-4.462 9.954-9.944.002-2.656-1.03-5.153-2.905-7.03C16.208 3.238 13.716 2.2 11.063 2.2c-5.491 0-9.957 4.463-9.96 9.946-.001 1.839.48 3.633 1.393 5.179l.265.447-.925 3.385 3.463-.908c1.5.819 3.197 1.25 4.92 1.251zM18.06 14.88c-.33-.165-1.956-.967-2.257-1.077-.302-.11-.522-.165-.742.165-.22.33-.852 1.077-1.044 1.298-.193.22-.385.242-.715.077-.33-.165-1.393-.513-2.653-1.637-.98-.874-1.64-1.954-1.832-2.284-.193-.33-.02-.508.145-.672.148-.148.33-.385.495-.578.165-.192.22-.33.33-.55.11-.22.055-.412-.028-.577-.082-.165-.742-1.79-.88-2.12-.276-.665-.558-.574-.766-.585-.198-.01-.424-.01-.65-.01s-.592.085-.902.424c-.31.339-1.187 1.161-1.187 2.83 0 1.669 1.213 3.28 1.378 3.5.165.22 2.387 3.646 5.783 5.111.808.349 1.439.557 1.93.713.812.258 1.552.221 2.138.134.652-.097 1.956-.8 2.23-1.57.275-.77.275-1.43.193-1.57-.083-.14-.303-.225-.633-.39z" />
            </svg>
            WA Venecia
          </a>
          <a
            href="https://wa.me/526862761824"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 bg-[#25D366]/10 border border-[#25D366]/30 hover:border-[#25D366] rounded-lg flex items-center justify-center gap-2 text-white/90 hover:text-white font-sans text-[10px] font-bold uppercase transition-all"
          >
            <svg className="w-4 h-4 fill-current text-[#25D366]" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-3.535l.409.243c1.517.901 3.23 1.378 4.978 1.379 5.485 0 9.95-4.462 9.954-9.944.002-2.656-1.03-5.153-2.905-7.03C16.208 3.238 13.716 2.2 11.063 2.2c-5.491 0-9.957 4.463-9.96 9.946-.001 1.839.48 3.633 1.393 5.179l.265.447-.925 3.385 3.463-.908c1.5.819 3.197 1.25 4.92 1.251zM18.06 14.88c-.33-.165-1.956-.967-2.257-1.077-.302-.11-.522-.165-.742.165-.22.33-.852 1.077-1.044 1.298-.193.22-.385.242-.715.077-.33-.165-1.393-.513-2.653-1.637-.98-.874-1.64-1.954-1.832-2.284-.193-.33-.02-.508.145-.672.148-.148.33-.385.495-.578.165-.192.22-.33.33-.55.11-.22.055-.412-.028-.577-.082-.165-.742-1.79-.88-2.12-.276-.665-.558-.574-.766-.585-.198-.01-.424-.01-.65-.01s-.592.085-.902.424c-.31.339-1.187 1.161-1.187 2.83 0 1.669 1.213 3.28 1.378 3.5.165.22 2.387 3.646 5.783 5.111.808.349 1.439.557 1.93.713.812.258 1.552.221 2.138.134.652-.097 1.956-.8 2.23-1.57.275-.77.275-1.43.193-1.57-.083-.14-.303-.225-.633-.39z" />
            </svg>
            WA San Marcos
          </a>
        </div>
      </div>

    </div>
  );
}

function formatWhatsAppLink(value: string): string {
  if (!value) return '';
  const val = value.trim();
  if (val.startsWith('http://') || val.startsWith('https://')) {
    return val;
  }
  const cleanNumber = val.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}`;
}
