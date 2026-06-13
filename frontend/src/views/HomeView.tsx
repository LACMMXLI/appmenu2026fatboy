import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, ChevronDown, ChevronRight, Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import {
  getHomeBanners, getCategories, getProducts, getSystemSettings,
  defaultProductImage,
  type HomeBanner, type Category, type Product,
} from '@/lib/api';


interface HomeViewProps {
  onNavigate: (view: any, product?: Product) => void;
}

/* ── Static fallback data ─────────────────────── */
const FALLBACK_BANNERS: HomeBanner[] = [
  {
    id: 'b1',
    imageUrl: '/images/hero_burger_1781279338325.png',
    title: 'HAMBURGUESAS\nSIN EXCUSAS',
    subtitle: 'Carne smash, ingredientes frescos y sabor inolvidable.',
    buttonText: 'VER MENÚ',
    linkView: 'menu',
    order: 0,
  },
  {
    id: 'b2',
    imageUrl: '/images/promo_banner_2x1_1781279460341.png',
    title: '2X1\nEN CLÁSICAS',
    subtitle: 'Solo por tiempo limitado, ¡no te lo pierdas!',
    buttonText: 'VER PROMOS',
    linkView: 'promos',
    order: 1,
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  'hamburguesa': '/images/category_icon_burger_1781279364406.png',
  'combo':       '/images/category_icon_combo_1781279372441.png',
  'dog':         '/images/category_icon_fries_1781279382390.png', /* Hot-dogs ahora usan icono de fries/snack para no repetir */
  'burrito':     '/images/category_icon_combo_1781279372441.png',
  'mexican':     '/images/category_icon_combo_1781279372441.png',
  'sushi':       '/images/category_icon_combo_1781279372441.png',
  'torta':       '/images/category_icon_combo_1781279372441.png',
  'charola':     '/images/category_icon_combo_1781279372441.png',
  'teriyaki':    '/images/category_icon_combo_1781279372441.png',
  'extra':       '/images/category_icon_fries_1781279382390.png',
  'pap':         '/images/category_icon_fries_1781279382390.png',
  'snack':       '/images/category_icon_fries_1781279382390.png',
  'nacho':       '/images/category_icon_fries_1781279382390.png',
  'bebida':      '/images/category_icon_drink_1781279391532.png',
  'postre':      '/images/category_icon_dessert_1781279400475.png',
};

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();
  for (const [key, img] of Object.entries(CATEGORY_ICONS)) {
    if (n.includes(key)) return img;
  }
  return '/images/category_icon_burger_1781279364406.png';
}

const STATIC_PROMOS = [
  { id: 'p1', img: '/images/promo_banner_combo_fatboy_1781279450113.png',  label: 'COMBO FATBOY' },
  { id: 'p2', img: '/images/promo_banner_2x1_1781279460341.png',            label: '2X1 CLÁSICAS' },
  { id: 'p3', img: '/images/promo_banner_papas_gratis_1781279470761.png',   label: 'PAPAS GRATIS' },
];

const FALLBACK_PRODUCTS = [
  { id: 'fp1', name: 'FATBOY CLÁSICA',  price: 139, description: 'Doble carne smash, queso americano, lechuga, tomate, cebolla, pepinillos y nuestra salsa Fatboy.', imageUrl: '/images/product_fatboy_clasica_1781279420825.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const } },
  { id: 'fp2', name: 'FATBOY BACON',    price: 159, description: 'Doble carne smash, queso americano, bacon crujiente, cebolla caramelizada y salsa Fatboy.', imageUrl: '/images/product_fatboy_bacon_1781279428950.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const } },
  { id: 'fp3', name: 'FATBOY MUSHROOM', price: 155, description: 'Doble carne smash, queso suizo, champiñones salteados, cebolla caramelizada y aioli de ajo.', imageUrl: '/images/product_fatboy_mushroom_1781279439261.png', categoryId: 'cat-burger', status: 'active' as const, isPromotion: false, shortDescription: null, promotionTag: null, promotionTagColor: null, category: { id: 'cat-burger', name: 'HAMBURGUESAS', order: 0, status: 'active' as const } },
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

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 120 }}>
      {/* background image */}
      <img
        key={b.id}
        src={b.imageUrl}
        alt={b.title || 'Banner'}
        className="absolute right-0 top-0 h-full w-1/2 object-cover animate-fade-in"
        style={{ objectPosition: 'center' }}
      />

      {/* Dark overlay left side */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(100deg, rgba(10,10,10,0.95) 30%, rgba(10,10,10,0.5) 60%, rgba(10,10,10,0) 100%)' }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-center px-3 z-10">
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
      </div>

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

/* ─────────────────────────────────────────────────
   MAIN HOME VIEW
───────────────────────────────────────────────── */
export function HomeView({ onNavigate }: HomeViewProps) {
  const [banners, setBanners]     = useState<HomeBanner[]>(FALLBACK_BANNERS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings]     = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let m = true;
    Promise.allSettled([getHomeBanners(), getCategories(), getSystemSettings()])
      .then(([bRes, cRes, sRes]) => {
        if (!m) return;
        if (bRes.status === 'fulfilled' && bRes.value.length > 0) setBanners(bRes.value);
        if (cRes.status === 'fulfilled') setCategories(cRes.value);
        if (sRes.status === 'fulfilled') setSettings(sRes.value);
      })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);


  return (
    <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingTop: 44, paddingBottom: 60 }}>

      {/* ── HERO SLIDER ──────────────────────────── */}
      <HeroSlider banners={banners} onNavigate={onNavigate} />

      {/* ── CATEGORY PILLS ───────────────────────── */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-3">
        {categories.map(cat => (
          <div
            key={cat.id}
            className="cat-item"
            onClick={() => onNavigate('menu', cat.id)}
          >
            <div className="cat-img-wrap">
              <img src={getCategoryIcon(cat.name)} alt={cat.name} className="w-full h-full object-cover" />
            </div>
            <span className="cat-label">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* ── PROMOS DEL DÍA ───────────────────────── */}
      <div>
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
          {STATIC_PROMOS.map(promo => (
            <div
              key={promo.id}
              className="promo-card"
              onClick={() => onNavigate('promos')}
            >
              <img src={promo.img} alt={promo.label} className="w-full h-full object-cover rounded-[10px]" />
            </div>
          ))}
        </div>
      </div>

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

