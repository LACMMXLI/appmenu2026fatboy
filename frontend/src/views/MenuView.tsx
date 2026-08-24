import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Flame, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { defaultProductImage, getCategories, getProducts, resolveMediaUrl, type Category, type Product } from '@/lib/api';

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
  'marisc':      '/images/promo_mariscos_2.png',
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
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

  const cleanQuery = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!cleanQuery) return [];
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(cleanQuery);
      const matchDesc = (p.description || p.shortDescription || '').toLowerCase().includes(cleanQuery);
      const matchSub = (p.subcategory || '').toLowerCase().includes(cleanQuery);
      return matchName || matchDesc || matchSub;
    });
  }, [products, cleanQuery]);

  const visible = useMemo(
    () => products.filter(p => p.categoryId === activeCategoryId),
    [products, activeCategoryId],
  );

  const productGroups = useMemo(() => {
    const groups: Array<{ name: string; products: Product[] }> = [];

    for (const product of visible) {
      const name = product.subcategory?.trim() || '';
      const currentGroup = groups.at(-1);
      if (!currentGroup || currentGroup.name !== name) {
        groups.push({ name, products: [product] });
      } else {
        currentGroup.products.push(product);
      }
    }

    return groups;
  }, [visible]);

  const handleAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addItem({
      id: product.id,
      title: product.name,
      price: product.price,
      qty: 1,
      img: resolveMediaUrl(product.imageUrl) || defaultProductImage,
      isPromotion: product.isPromotion,
      extras: [],
      removals: [],
      notes: '',
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto no-scrollbar"
      style={{ paddingTop: 36, paddingBottom: 72 }}
    >
      {/* ── HEADER & SEARCH ───────────────────────── */}
      <div
        className="sticky top-0 z-40 px-3 py-2 flex flex-col gap-2"
        style={{ background: 'rgba(13, 13, 13, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-outline)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-lg tracking-widest flex-1" style={{ letterSpacing: '.06em' }}>MENÚ</h1>
          {!isSearching ? (
            <button
              onClick={() => setIsSearching(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-white/70 bg-surface border border-outline hover:text-white hover:border-white/20 transition-all active:scale-95"
            >
              <Search size={12} className="text-gold" /> Buscar...
            </button>
          ) : (
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white/60 hover:text-white"
            >
              <X size={13} /> Cancelar
            </button>
          )}
        </div>

        {isSearching && (
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-gold pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o ingrediente..."
              className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── CATEGORY PILLS (only when not actively searching) ──────── */}
      {!cleanQuery && (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 pt-2 pb-1">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={cn('cat-item', activeCategoryId === cat.id && 'active')}
              onClick={() => setActiveCategoryId(cat.id)}
            >
              <div className="cat-img-wrap">
                <img
                  src={resolveMediaUrl(cat.imageUrl) || getCategoryIcon(cat.name)}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="cat-label">{cat.name}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* ── SEARCH RESULTS ──────────────────────── */}
      {!isLoading && !error && cleanQuery && (
        <div className="pt-2">
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              Resultados para "{searchQuery}"
            </span>
            <span className="text-[10px] font-bold text-gold">
              {searchResults.length} {searchResults.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          {searchResults.length === 0 ? (
            <div className="mx-3 mt-4 p-6 rounded-2xl text-xs text-center text-white/50 bg-[#161616] border border-white/5">
              No se encontraron productos que coincidan con tu búsqueda.
            </div>
          ) : (
            searchResults.map((product, pIndex) => {
              const isReversed = pIndex % 2 === 1;
              return (
                <div
                  key={product.id}
                  className={cn('product-card group', isReversed && 'reversed')}
                  onClick={() => onNavigate('product-detail', product)}
                >
                  <div className="product-card-body">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h3 className="product-name">{product.name}</h3>
                        {product.isPromotion && (
                          <span className="product-badge bg-primary text-white">
                            PROMO
                          </span>
                        )}
                        {product.promotionTag && (
                          <span
                            className="product-badge"
                            style={{
                              backgroundColor: product.promotionTagColor || 'var(--color-gold)',
                              color: '#111',
                            }}
                          >
                            {product.promotionTag}
                          </span>
                        )}
                      </div>
                      <p className="product-desc">
                        {product.description || product.shortDescription || 'Especialidad preparada al momento con ingredientes frescos.'}
                      </p>
                    </div>
                    <div className="product-footer">
                      <span className="product-price">
                        ${Number(product.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="product-add-btn"
                        onClick={e => handleAdd(e, product)}
                        aria-label={`Agregar ${product.name}`}
                      >
                        <Plus size={16} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <div className="product-image-container">
                    <img
                      src={resolveMediaUrl(product.imageUrl) || defaultProductImage}
                      alt={product.name}
                      loading="lazy"
                      className="product-thumb"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {!isLoading && !error && !cleanQuery && visible.length === 0 && (
        <div className="mx-3 mt-4 p-4 rounded-xl text-xs text-center text-[#555]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}>
          No hay productos en esta categoría.
        </div>
      )}

      {/* ── PRODUCT LIST BY CATEGORY ──────────────── */}
      {!isLoading && !error && !cleanQuery && categories
        .filter(c => c.id === activeCategoryId)
        .map(category => (
          <div key={category.id} className="pt-1">
            <h2
              className="px-3 pt-2 pb-1 text-[11px] font-black uppercase tracking-widest text-gold/90"
            >
              {category.name}
            </h2>

            {productGroups.map((group, groupIndex) => (
              <section key={group.name || `general-${groupIndex}`}>
                {group.name && (
                  <h3
                    className="sticky top-[49px] z-30 mx-3 mt-2 mb-1 rounded-lg px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.14em] shadow-lg border border-white/10"
                    style={{
                      color: 'var(--color-gold)',
                      background: 'rgba(24, 24, 24, 0.94)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {group.name}
                  </h3>
                )}

                {group.products.map(product => {
                  const globalIndex = visible.findIndex(p => p.id === product.id);
                  const isReversed = (globalIndex >= 0 ? globalIndex : 0) % 2 === 1;
                  return (
                    <div
                      key={product.id}
                      className={cn('product-card group', isReversed && 'reversed')}
                      onClick={() => onNavigate('product-detail', product)}
                    >
                      <div className="product-card-body">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <h3 className="product-name">{product.name}</h3>
                            {product.isPromotion && (
                              <span className="product-badge bg-primary text-white">
                                PROMO
                              </span>
                            )}
                            {product.promotionTag && (
                              <span
                                className="product-badge"
                                style={{
                                  backgroundColor: product.promotionTagColor || 'var(--color-gold)',
                                  color: '#111',
                                }}
                              >
                                {product.promotionTag}
                              </span>
                            )}
                          </div>
                          <p className="product-desc">
                            {product.description || product.shortDescription || 'Especialidad preparada al momento con ingredientes frescos.'}
                          </p>
                        </div>
                        <div className="product-footer">
                          <span className="product-price">
                            ${Number(product.price).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="product-add-btn"
                            onClick={e => handleAdd(e, product)}
                            aria-label={`Agregar ${product.name}`}
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                      <div className="product-image-container">
                        <img
                          src={resolveMediaUrl(product.imageUrl) || defaultProductImage}
                          alt={product.name}
                          loading="lazy"
                          className="product-thumb"
                        />
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        ))
      }
    </div>
  );
}
