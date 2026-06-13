import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { defaultProductImage, getCategories, getProducts, type Category, type Product } from '@/lib/api';

const CATEGORY_ICONS: Record<string, string> = {
  'hamburguesa': '/images/category_icon_burger_1781279364406.png',
  'combo':       '/images/category_icon_combo_1781279372441.png',
  'dog':         '/images/category_icon_burger_1781279364406.png',
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

interface MenuViewProps {
  onNavigate: (view: string, product?: Product) => void;
  initialCategoryId?: string | null;
}

export function MenuView({ onNavigate, initialCategoryId }: MenuViewProps) {
  const { addItem } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const loadMenu = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
      setCategories(cats);
      setProducts(prods);
      setActiveCategoryId((current) => current || initialCategoryId || cats[0]?.id || '');
    } catch {
      setError('No se pudo cargar el menú. Verifica el backend.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [initialCategoryId]);

  useEffect(() => {
    void loadMenu(true);
  }, [loadMenu]);

  useEffect(() => {
    const refreshVisibleMenu = () => {
      if (document.visibilityState === 'visible') {
        void loadMenu(false);
      }
    };

    window.addEventListener('focus', refreshVisibleMenu);
    document.addEventListener('visibilitychange', refreshVisibleMenu);

    return () => {
      window.removeEventListener('focus', refreshVisibleMenu);
      document.removeEventListener('visibilitychange', refreshVisibleMenu);
    };
  }, [loadMenu]);

  useEffect(() => {
    if (initialCategoryId) {
      setActiveCategoryId(initialCategoryId);
    }
  }, [initialCategoryId]);

  const visible = useMemo(
    () => products.filter(p => p.categoryId === activeCategoryId),
    [products, activeCategoryId],
  );

  const handleAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addItem({
      id: product.id,
      title: product.name,
      price: product.price,
      qty: 1,
      img: product.imageUrl || defaultProductImage,
      extras: [],
      removals: [],
      notes: '',
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto no-scrollbar"
      style={{ paddingTop: 36, paddingBottom: 38 }}
    >
      {/* ── HEADER ───────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-3 py-2 flex items-center gap-2"
        style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-outline)' }}
      >
        <h1 className="font-display text-lg tracking-widest flex-1" style={{ letterSpacing: '.06em' }}>MENÚ</h1>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[9.5px] font-bold"
          style={{ background: 'var(--color-surface)', color: '#666', border: '1px solid var(--color-outline)' }}
        >
          <Search size={12} /> Buscar...
        </button>
      </div>

      {/* ── CATEGORY PILLS ───────────────────────── */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 pt-2 pb-1">
        {categories.map(cat => (
          <div
            key={cat.id}
            className={cn('cat-item', activeCategoryId === cat.id && 'active')}
            onClick={() => setActiveCategoryId(cat.id)}
          >
            <div className="cat-img-wrap">
              <img
                src={cat.imageUrl || getCategoryIcon(cat.name)}
                alt={cat.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="cat-label">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* ── STATE MESSAGES ──────────────────────── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Flame size={24} className="text-primary animate-bounce" style={{ color: 'var(--color-primary)' }} />
          <span className="text-[10.5px] font-bold text-[#555] uppercase tracking-widest">Cargando menú...</span>
        </div>
      )}

      {error && (
        <div className="mx-3 mt-3 p-3 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(232,0,10,0.08)', border: '1px solid rgba(232,0,10,0.2)', color: 'var(--color-primary)' }}>
          {error}
        </div>
      )}

      {!isLoading && !error && visible.length === 0 && (
        <div className="mx-3 mt-4 p-4 rounded-lg text-xs text-center text-[#555]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}>
          No hay productos en esta categoría.
        </div>
      )}

      {/* ── PRODUCT LIST ─────────────────────────── */}
      {!isLoading && !error && categories
        .filter(c => c.id === activeCategoryId)
        .map(category => (
          <div key={category.id}>
            <h2
              className="px-3 pt-3 pb-1 text-[11.5px] font-black uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {category.name}
            </h2>

            {visible.map(product => (
              <div
                key={product.id}
                className="product-row"
                onClick={() => onNavigate('product-detail', product)}
              >
                <img
                  src={product.imageUrl || defaultProductImage}
                  alt={product.name}
                  className="product-thumb"
                />
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  <p className="product-desc">{product.description || product.shortDescription || 'Producto Fatboy'}</p>
                  <p className="product-price">${product.price}.00</p>
                </div>
                <button
                  className="add-btn"
                  onClick={e => handleAdd(e, product)}
                  aria-label={`Agregar ${product.name}`}
                >
                  <Plus size={13} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  );
}
