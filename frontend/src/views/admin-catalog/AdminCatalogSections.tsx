import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Gift, Image, Plus, RefreshCw, Save, Search, Settings, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { GOOGLE_REVIEW_BRANCHES, buildGoogleReviewUrl } from '@/lib/googleReviews';
import {
  getSystemSettings,
  updateAdminSystemSettings,
  type Branch,
  type Category,
  type Customer,
  type FeedbackItem,
  type HomeBanner,
  type Order,
  type Product,
  type RedeemableProduct,
} from '@/lib/api';
import type { NewBanner, NewProduct, NewRedeemableProduct } from './adminCatalogTypes';

const [veneciaReviewBranch, sanMarcosReviewBranch] = GOOGLE_REVIEW_BRANCHES;

// --- SUB-COMPONENTE PRODUCTOS ---
interface ProductsAdminProps {
  categories: Category[];
  activeCategories: Category[];
  products: Product[];
  search: string;
  selectedCategoryId: string;
  newProduct: NewProduct;
  isLoading: boolean;
  onSearch: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onNewProductChange: (value: NewProduct) => void;
  onCreateProduct: () => Promise<void> | void;
  onProductChange: (id: string, patch: Partial<Product>) => void;
  onSaveProduct: (product: Product) => void;
  onCancelChanges: () => void;
  onDeleteProduct: (product: Product) => void;
}

export function ProductsAdmin({
  categories,
  activeCategories,
  products,
  search,
  selectedCategoryId,
  newProduct,
  isLoading,
  onSearch,
  onCategoryFilterChange,
  onNewProductChange,
  onCreateProduct,
  onProductChange,
  onSaveProduct,
  onCancelChanges,
  onDeleteProduct,
}: ProductsAdminProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const selectedCategoryName = selectedCategoryId
    ? categories.find((category) => category.id === selectedCategoryId)?.name
    : 'Todas las categorias';

  function openCreateModal() {
    const defaultCategoryId = activeCategories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : activeCategories[0]?.id || '';

    onNewProductChange({
      ...newProduct,
      categoryId: newProduct.categoryId || defaultCategoryId,
    });
    setIsCreateOpen(true);
  }

  async function handleCreateProduct() {
    if (!newProduct.name || !(newProduct.categoryId || activeCategories[0]?.id)) return;
    await onCreateProduct();
    setIsCreateOpen(false);
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-outline bg-[linear-gradient(135deg,rgba(232,0,10,0.13),rgba(24,24,24,0.96)_42%,rgba(250,189,0,0.08))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto min-w-[220px]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Inventario comercial</p>
            <h3 className="text-lg font-black uppercase tracking-wide text-white">Productos por categoria</h3>
            <p className="text-xs font-medium text-gray-400">{selectedCategoryName} · {products.length} productos visibles</p>
          </div>
          <Button onClick={openCreateModal} disabled={isLoading || activeCategories.length === 0}>
            <Plus size={16} className="mr-2" /> Nuevo producto
          </Button>
        </div>
      </motion.div>

      <div className="rounded-xl border border-outline bg-surface p-3 shadow-md">
        <div className="flex items-center gap-3 rounded-lg border border-outline bg-background px-3 py-2">
          <Search size={18} className="shrink-0 text-gray-500" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar por producto, categoría o descripción..."
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryFilterChange('')}
            className={cn(
              'h-10 shrink-0 rounded-lg border px-4 text-xs font-black uppercase tracking-wide transition-all',
              !selectedCategoryId
                ? 'border-primary bg-primary text-white shadow-[0_0_18px_rgba(232,0,10,0.22)]'
                : 'border-outline bg-background text-gray-400 hover:border-primary/50 hover:text-white',
            )}
          >
            Todas ({categories.length})
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryFilterChange(category.id)}
              className={cn(
                'h-10 shrink-0 rounded-lg border px-4 text-xs font-black uppercase tracking-wide transition-all',
                selectedCategoryId === category.id
                  ? 'border-primary bg-primary text-white shadow-[0_0_18px_rgba(232,0,10,0.22)]'
                  : 'border-outline bg-background text-gray-400 hover:border-primary/50 hover:text-white',
              )}
            >
              {category.name} ({category._count?.products ?? 0})
            </button>
          ))}
        </div>
      </div>

      <motion.div layout className="grid gap-3">
        <AnimatePresence initial={false}>
          {products.map((product, index) => (
            <motion.article
              key={product.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.018, 0.08) }}
              className="grid gap-4 rounded-xl border border-outline bg-surface p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition-colors hover:border-primary/35 hover:bg-surface-2/60 xl:grid-cols-[116px_minmax(0,1.25fr)_minmax(280px,1fr)_210px]"
            >
              <div className="flex gap-3 xl:block">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-outline bg-background xl:h-[104px] xl:w-full">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-600">
                      <Image size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 xl:hidden">
                  <p className="break-words text-base font-black text-white">{product.name || 'Producto sin nombre'}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">{product.category.name}</p>
                  <p className="mt-2 text-lg font-black text-gold">${Number(product.price).toFixed(2)}</p>
                </div>
              </div>

              <div className="grid min-w-0 gap-3">
                <div className="hidden xl:block">
                  <p className="break-words text-base font-black text-white">{product.name || 'Producto sin nombre'}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">{product.category.name}</p>
                </div>
                <Input
                  label="Nombre"
                  value={product.name}
                  onChange={(event) => onProductChange(product.id, { name: event.target.value })}
                  className="h-11 bg-background"
                />
                <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <Input
                    label="Precio"
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.price}
                    onChange={(event) => onProductChange(product.id, { price: Number(event.target.value) })}
                    className="h-11 bg-background font-bold"
                  />
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Categoría
                    <select
                      value={product.categoryId}
                      onChange={(event) => onProductChange(product.id, { categoryId: event.target.value })}
                      className="h-11 w-full rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid min-w-0 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Descripción
                  <textarea
                    value={product.description ?? ''}
                    onChange={(event) => onProductChange(product.id, { description: event.target.value })}
                    className="min-h-[86px] w-full resize-y rounded-lg border border-outline bg-background px-3 py-2 text-sm leading-5 text-white outline-none focus:border-primary"
                  />
                </label>
                <Input
                  label="URL imagen"
                  value={product.imageUrl ?? ''}
                  onChange={(event) => onProductChange(product.id, { imageUrl: event.target.value })}
                  placeholder="https://..."
                  className="h-11 bg-background text-xs"
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 xl:flex-col xl:items-stretch">
                <div className="grid gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Estado</span>
                  <button
                    type="button"
                    onClick={() => onProductChange(product.id, { status: product.status === 'active' ? 'inactive' : 'active' })}
                    className={cn('h-10 rounded-lg px-4 text-xs font-black uppercase transition-all', product.status === 'active' ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-primary/15 text-primary border border-primary/30')}
                  >
                    {product.status === 'active' ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <div className="grid min-w-[260px] grid-cols-3 gap-2 xl:w-full">
                  <Button size="sm" onClick={() => onSaveProduct(product)} disabled={isLoading} className="bg-primary/90 hover:bg-primary">
                    <Save size={15} className="mr-1.5" /> Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCancelChanges} disabled={isLoading}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDeleteProduct(product)} disabled={isLoading} className="border-primary/45 text-primary hover:bg-primary/10">
                    <Trash2 size={15} className="mr-1.5" /> Eliminar
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>

        {products.length === 0 && (
          <div className="rounded-xl border border-dashed border-outline bg-surface p-10 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-white">Sin productos visibles</p>
            <p className="mt-1 text-xs font-medium text-gray-400">Cambia la categoria o la busqueda para ver mas resultados.</p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Nuevo producto"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-outline bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            >
              <div className="sticky top-0 z-10 border-b border-outline bg-surface/95 px-5 py-4 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Alta de producto</p>
                <h3 className="text-xl font-black uppercase tracking-wide text-white">Nuevo producto</h3>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl border border-outline bg-background">
                  <div className="aspect-square">
                    {newProduct.imageUrl ? (
                      <img src={newProduct.imageUrl} alt={newProduct.name || 'Nuevo producto'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-600">
                        <Image size={34} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <Input label="Nombre" value={newProduct.name} onChange={(event) => onNewProductChange({ ...newProduct, name: event.target.value })} autoFocus />
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Input label="Precio" type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => onNewProductChange({ ...newProduct, price: Number(event.target.value) })} />
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Categoría
                      <select
                        value={newProduct.categoryId || activeCategories[0]?.id || ''}
                        onChange={(event) => onNewProductChange({ ...newProduct, categoryId: event.target.value })}
                        className="h-14 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
                      >
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Input label="URL imagen" value={newProduct.imageUrl} onChange={(event) => onNewProductChange({ ...newProduct, imageUrl: event.target.value })} placeholder="https://..." />
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Descripción
                    <textarea
                      value={newProduct.description}
                      onChange={(event) => onNewProductChange({ ...newProduct, description: event.target.value })}
                      className="min-h-[110px] w-full resize-y rounded-lg border border-outline bg-background px-4 py-3 text-sm leading-5 text-white outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-outline px-5 py-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreateProduct} disabled={isLoading || !newProduct.name || !(newProduct.categoryId || activeCategories[0]?.id)}>
                  <Plus size={16} className="mr-2" /> Crear producto
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTE CATEGORIAS ---
interface CategoriesAdminProps {
  categories: Category[];
  newCategory: { name: string; order: number; imageUrl: string };
  isLoading: boolean;
  onNewCategoryChange: (value: { name: string; order: number; imageUrl: string }) => void;
  onCreateCategory: () => void;
  onCategoryChange: (id: string, patch: Partial<Category>) => void;
  onSaveCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}

export function CategoriesAdmin({
  categories,
  newCategory,
  isLoading,
  onNewCategoryChange,
  onCreateCategory,
  onCategoryChange,
  onSaveCategory,
  onDeleteCategory,
}: CategoriesAdminProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[1fr_140px_1.4fr_auto]">
        <Input label="Nueva categoría" value={newCategory.name} onChange={(event) => onNewCategoryChange({ ...newCategory, name: event.target.value })} />
        <Input label="Orden" type="number" min="0" value={newCategory.order} onChange={(event) => onNewCategoryChange({ ...newCategory, order: Number(event.target.value) })} />
        <Input label="URL imagen" value={newCategory.imageUrl} onChange={(event) => onNewCategoryChange({ ...newCategory, imageUrl: event.target.value })} />
        <Button className="self-end animate-pulse-glow" onClick={onCreateCategory} disabled={isLoading || !newCategory.name}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Orden</th>
              <th className="p-3 text-left">Imagen (URL)</th>
              <th className="p-3 text-left">Productos</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-t border-outline/50 hover:bg-surface-hover/30 transition-colors">
                <td className="p-2">
                  <input value={category.name} onChange={(event) => onCategoryChange(category.id, { name: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white" />
                </td>
                <td className="p-2">
                  <input type="number" min="0" value={category.order} onChange={(event) => onCategoryChange(category.id, { order: Number(event.target.value) })} className="h-10 w-28 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white font-semibold" />
                </td>
                <td className="p-2">
                  <div className="flex min-w-[260px] items-center gap-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-outline bg-background">
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-600">
                          <Image size={15} />
                        </div>
                      )}
                    </div>
                    <input value={category.imageUrl ?? ''} onChange={(event) => onCategoryChange(category.id, { imageUrl: event.target.value })} placeholder="https://..." className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white text-xs" />
                  </div>
                </td>
                <td className="p-2 text-gray-300 font-semibold">{category._count?.products ?? 0}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => onCategoryChange(category.id, { status: category.status === 'active' ? 'inactive' : 'active' })}
                    className={cn('h-9 rounded-md px-3 text-xs font-bold uppercase transition-all', category.status === 'active' ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-primary/15 text-primary border border-primary/30')}
                  >
                    {category.status === 'active' ? 'Activa' : 'Inactiva'}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => onSaveCategory(category)} disabled={isLoading} className="bg-primary/90 hover:bg-primary"><Save size={15} /></Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteCategory(category)} disabled={isLoading}><Trash2 size={15} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE PROMOCIONES ---
interface PromotionsAdminProps {
  products: Product[];
  isLoading: boolean;
  onProductChange: (id: string, patch: Partial<Product>) => void;
  onSaveProduct: (product: Product) => void;
}

export function PromotionsAdmin({ products, isLoading, onProductChange, onSaveProduct }: PromotionsAdminProps) {
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-outline p-4 rounded-xl">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Administrar Promociones</h3>
        <p className="text-xs text-gray-400">Marca productos como promociones y especifica sus etiquetas promocionales que verán los usuarios.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3 text-left">Precio</th>
              <th className="p-3 text-left">¿Es Promoción?</th>
              <th className="p-3 text-left">Etiqueta de Promo (Tag)</th>
              <th className="p-3 text-left">Color de Etiqueta</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-outline/50 hover:bg-surface-hover/30 transition-colors">
                <td className="p-3 font-semibold text-white">{product.name}</td>
                <td className="p-3 text-accent font-bold">${product.price}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={product.isPromotion}
                    onChange={(e) => onProductChange(product.id, { isPromotion: e.target.checked })}
                    className="w-5 h-5 accent-primary cursor-pointer rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    placeholder="Ej: 🔥 HOT"
                    value={product.promotionTag || ''}
                    disabled={!product.isPromotion}
                    onChange={(e) => onProductChange(product.id, { promotionTag: e.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary disabled:opacity-40 text-white"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={product.promotionTagColor || 'red'}
                    disabled={!product.isPromotion}
                    onChange={(e) => onProductChange(product.id, { promotionTagColor: e.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary disabled:opacity-40 text-white"
                  >
                    <option value="red">Rojo (Primary)</option>
                    <option value="yellow">Amarillo (Accent)</option>
                    <option value="gray">Gris (Transparent)</option>
                  </select>
                </td>
                <td className="p-2">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => onSaveProduct(product)} disabled={isLoading} className="bg-primary/90 hover:bg-primary flex gap-1">
                      <Save size={15} /> Guardar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE CANJEABLES ---
interface RedeemableProductsAdminProps {
  products: RedeemableProduct[];
  newProduct: NewRedeemableProduct;
  isLoading: boolean;
  onNewProductChange: (value: NewRedeemableProduct) => void;
  onProductChange: (id: string, patch: Partial<RedeemableProduct>) => void;
  onCreateProduct: () => void;
  onSaveProduct: (product: RedeemableProduct) => void;
  onDeleteProduct: (product: RedeemableProduct) => void;
}

export function RedeemableProductsAdmin({
  products,
  newProduct,
  isLoading,
  onNewProductChange,
  onProductChange,
  onCreateProduct,
  onSaveProduct,
  onDeleteProduct,
}: RedeemableProductsAdminProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-outline bg-surface p-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Gift size={16} className="text-accent" /> Productos canjeables
        </h3>
        <p className="text-xs text-gray-400">
          Configura productos únicos para puntos. Solo los activos aparecen en la vista de recompensas del cliente.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[1.2fr_130px_1.5fr_90px_auto]">
        <Input
          label="Nuevo canjeable"
          value={newProduct.name}
          onChange={(event) => onNewProductChange({ ...newProduct, name: event.target.value })}
        />
        <Input
          label="Puntos"
          type="number"
          min="1"
          value={newProduct.pointsCost}
          onChange={(event) => onNewProductChange({ ...newProduct, pointsCost: Number(event.target.value) })}
        />
        <Input
          label="URL imagen"
          value={newProduct.imageUrl}
          onChange={(event) => onNewProductChange({ ...newProduct, imageUrl: event.target.value })}
        />
        <Input
          label="Orden"
          type="number"
          min="0"
          value={newProduct.order}
          onChange={(event) => onNewProductChange({ ...newProduct, order: Number(event.target.value) })}
        />
        <Button className="self-end animate-pulse-glow" onClick={onCreateProduct} disabled={isLoading || !newProduct.name}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
        <div className="md:col-span-5">
          <Input
            label="Descripción"
            value={newProduct.description}
            onChange={(event) => onNewProductChange({ ...newProduct, description: event.target.value })}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3 text-left">Puntos</th>
              <th className="p-3 text-left">Imagen</th>
              <th className="p-3 text-left">Descripción</th>
              <th className="p-3 text-left">Orden</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-outline/50 hover:bg-surface-hover/30 transition-colors">
                <td className="p-2">
                  <input
                    value={product.name}
                    onChange={(event) => onProductChange(product.id, { name: event.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={product.pointsCost}
                    onChange={(event) => onProductChange(product.id, { pointsCost: Number(event.target.value) })}
                    className="h-10 w-28 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-accent font-bold"
                  />
                </td>
                <td className="p-2">
                  <div className="flex min-w-[250px] items-center gap-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-outline bg-background">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-600">
                          <Image size={15} />
                        </div>
                      )}
                    </div>
                    <input
                      value={product.imageUrl ?? ''}
                      onChange={(event) => onProductChange(product.id, { imageUrl: event.target.value })}
                      placeholder="https://..."
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white text-xs"
                    />
                  </div>
                </td>
                <td className="p-2">
                  <input
                    value={product.description ?? ''}
                    onChange={(event) => onProductChange(product.id, { description: event.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    value={product.order}
                    onChange={(event) => onProductChange(product.id, { order: Number(event.target.value) })}
                    className="h-10 w-24 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white font-semibold"
                  />
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => onProductChange(product.id, { status: product.status === 'active' ? 'inactive' : 'active' })}
                    className={cn('h-9 rounded-md px-3 text-xs font-bold uppercase transition-all', product.status === 'active' ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-primary/15 text-primary border border-primary/30')}
                  >
                    {product.status === 'active' ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => onSaveProduct(product)} disabled={isLoading} className="bg-primary/90 hover:bg-primary"><Save size={15} /></Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteProduct(product)} disabled={isLoading}><Trash2 size={15} /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 font-semibold">
                  No hay productos canjeables configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE CLIENTES ---
interface CustomersAdminProps {
  customers: Customer[];
  search: string;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onCustomerChange: (id: string, patch: Partial<Customer>) => void;
  onSaveCustomer: (cust: Customer) => void;
  onDeleteCustomer: (id: string, name: string) => void;
}

export function CustomersAdmin({
  customers,
  search,
  isLoading,
  onSearchChange,
  onSearchSubmit,
  onCustomerChange,
  onSaveCustomer,
  onDeleteCustomer,
}: CustomersAdminProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-outline bg-surface px-4 py-2 shadow-md">
        <Search size={18} className="text-gray-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar cliente por nombre o teléfono..."
          className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
        />
        <Button size="sm" onClick={onSearchSubmit} disabled={isLoading}>Buscar</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Teléfono</th>
              <th className="p-3 text-left">Puntos Acumulados</th>
              <th className="p-3 text-left">Fecha Registro</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((cust) => (
              <tr key={cust.id} className="border-t border-outline/50 hover:bg-surface-hover/30 transition-colors">
                <td className="p-2">
                  <input value={cust.name} onChange={(event) => onCustomerChange(cust.id, { name: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white" />
                </td>
                <td className="p-2">
                  <input value={cust.phone} onChange={(event) => onCustomerChange(cust.id, { phone: event.target.value })} className="h-10 w-44 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white font-semibold" />
                </td>
                <td className="p-2">
                  <input type="number" min="0" value={cust.points} onChange={(event) => onCustomerChange(cust.id, { points: Number(event.target.value) })} className="h-10 w-28 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-accent font-bold" />
                </td>
                <td className="p-3 text-gray-400 text-xs">
                  {new Date(cust.createdAt).toLocaleDateString()}
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => onSaveCustomer(cust)} disabled={isLoading} className="bg-primary/90 hover:bg-primary"><Save size={15} /></Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteCustomer(cust.id, cust.name)} disabled={isLoading}><Trash2 size={15} /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500 font-semibold">No se encontraron clientes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE PEDIDOS ---
interface OrdersAdminProps {
  orders: Order[];
  branches: Branch[];
  branchFilter: string;
  isLoading: boolean;
  onBranchFilterChange: (id: string) => void;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export function OrdersAdmin({
  orders,
  branches,
  branchFilter,
  isLoading,
  onBranchFilterChange,
  onUpdateStatus,
}: OrdersAdminProps) {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'preparing': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'delivered': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'preparing': return 'Preparando';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-outline bg-surface p-4 shadow-md">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Filtrar por Sucursal:
          <select
            value={branchFilter}
            onChange={(e) => onBranchFilterChange(e.target.value)}
            className="h-10 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
          >
            <option value="">Todas las sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => {
          const shortId = order.id.substring(0, 8).toUpperCase();
          const itemsList = order.items.map(i => {
            const extText = i.extras ? ` (Extras: ${JSON.parse(i.extras).map((e: any) => e.name).join(', ')})` : '';
            const remText = i.removals ? ` (Sin: ${JSON.parse(i.removals).join(', ')})` : '';
            const prepText = i.meatPrep ? ` [${i.meatPrep}]` : '';
            return `${i.quantity}x ${i.productName}${prepText}${extText}${remText}`;
          });

          return (
            <div key={order.id} className="bg-surface border border-outline rounded-xl p-5 hover:border-gray-500 transition-colors shadow-lg">
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-outline/30 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg tracking-wider text-white">PEDIDO #{shortId}</span>
                    <span className={cn('text-xs font-bold border px-2 py-0.5 rounded-full uppercase', getStatusBadgeClass(order.status))}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 block mt-0.5">Fatboy {order.branchName} • {new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase tracking-widest leading-none">TOTAL</span>
                    <span className="font-display text-2xl text-accent font-bold">${order.total}</span>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <Button size="sm" onClick={() => onUpdateStatus(order.id, 'preparing')} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">Aceptar / Cocinar</Button>
                    )}
                    {order.status === 'preparing' && (
                      <Button size="sm" onClick={() => onUpdateStatus(order.id, 'delivered')} disabled={isLoading} className="bg-green-600 hover:bg-green-700">Entregar</Button>
                    )}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => onUpdateStatus(order.id, 'cancelled')} disabled={isLoading} className="border-primary/50 text-primary hover:bg-primary/10">Cancelar</Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Cliente</span>
                  <p className="font-semibold text-white text-sm">{order.customerName}</p>
                  <p className="text-xs text-gray-400">{order.customerPhone}</p>
                  {order.notes && <p className="text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/10 p-2 rounded mt-2">Nota: {order.notes}</p>}
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Ítems ({order.items.reduce((a, b) => a + b.quantity, 0)})</span>
                  <ul className="text-xs text-gray-300 list-disc pl-4 space-y-1 font-semibold">
                    {itemsList.map((item, idx) => (
                      <li key={idx} className="hover:text-white transition-colors">{item}</li>
                    ))}
                  </ul>
                  <div className="flex gap-4 text-[11px] text-gray-400 font-semibold mt-3 pt-2 border-t border-outline/10">
                    {order.pointsRedeemed > 0 && <span>Puntos Redimidos: <strong className="text-primary">{order.pointsRedeemed} pts</strong></span>}
                    {order.pointsEarned > 0 && <span>Puntos Ganados: <strong className="text-accent">{order.pointsEarned} pts</strong></span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && (
          <div className="bg-surface border border-outline rounded-xl p-8 text-center text-gray-500 font-semibold">
            No se encontraron pedidos.
          </div>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE BANNERS INICIO ---
interface BannersAdminProps {
  banners: HomeBanner[];
  newBanner: NewBanner;
  isLoading: boolean;
  onNewBannerChange: (value: NewBanner) => void;
  onCreateBanner: () => void;
  onBannerChange: (id: string, patch: Partial<HomeBanner>) => void;
  onSaveBanner: (banner: HomeBanner) => void;
  onDeleteBanner: (id: string) => void;
}

export function BannersAdmin({
  banners,
  newBanner,
  isLoading,
  onNewBannerChange,
  onCreateBanner,
  onBannerChange,
  onSaveBanner,
  onDeleteBanner,
}: BannersAdminProps) {
  return (
    <div className="space-y-6">
      {/* Formulario de creación */}
      <div className="rounded-xl border border-outline bg-surface p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Plus size={16} /> Crear Nuevo Banner de Inicio
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input 
            label="URL de la Imagen" 
            value={newBanner.imageUrl} 
            onChange={(e) => onNewBannerChange({ ...newBanner, imageUrl: e.target.value })} 
            placeholder="https://ejemplo.com/imagen.jpg"
          />
          <Input 
            label="Título Superpuesto" 
            value={newBanner.title} 
            onChange={(e) => onNewBannerChange({ ...newBanner, title: e.target.value })} 
            placeholder="Título del banner"
          />
          <Input 
            label="Subtítulo Superpuesto" 
            value={newBanner.subtitle} 
            onChange={(e) => onNewBannerChange({ ...newBanner, subtitle: e.target.value })} 
            placeholder="Subtítulo del banner"
          />
          <Input 
            label="Texto del Botón" 
            value={newBanner.buttonText} 
            onChange={(e) => onNewBannerChange({ ...newBanner, buttonText: e.target.value })} 
            placeholder="Ej: Ver Menú"
          />
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Vista de Destino
            <select
              value={newBanner.linkView}
              onChange={(e) => onNewBannerChange({ ...newBanner, linkView: e.target.value })}
              className="h-10 rounded-md border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
            >
              <option value="menu">Menú</option>
              <option value="promos">Promociones</option>
              <option value="rewards">Premios / Puntos</option>
              <option value="profile">Mi Perfil</option>
              <option value="branches">Sucursales</option>
            </select>
          </label>
          <Input 
            label="Orden de Visualización" 
            type="number" 
            min="0"
            value={newBanner.order} 
            onChange={(e) => onNewBannerChange({ ...newBanner, order: Number(e.target.value) })} 
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            className="animate-pulse-glow" 
            onClick={onCreateBanner} 
            disabled={isLoading || !newBanner.imageUrl}
          >
            <Plus size={16} className="mr-2" /> Crear Banner
          </Button>
        </div>
      </div>

      {/* Lista de banners */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
          Banners de Inicio Activos ({banners.length})
        </h3>

        <div className="grid gap-6">
          {banners.map((banner) => (
            <div 
              key={banner.id} 
              className="bg-surface border border-outline rounded-xl p-5 hover:border-gray-500 transition-colors shadow-lg grid md:grid-cols-[180px_1fr] gap-6"
            >
              {/* Vista previa de la imagen */}
              <div className="relative aspect-video md:aspect-square rounded-lg overflow-hidden bg-black border border-outline/30 flex items-center justify-center">
                {banner.imageUrl ? (
                  <img 
                    src={banner.imageUrl} 
                    alt={banner.title || 'Vista previa'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <Image size={32} className="text-gray-600" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-left">
                  <span className="font-display text-lg tracking-wider text-white uppercase truncate">{banner.title || 'SIN TÍTULO'}</span>
                  <span className="text-[10px] text-accent uppercase tracking-widest font-bold font-sans truncate">{banner.subtitle || 'Sin subtítulo'}</span>
                </div>
              </div>

              {/* Campos de edición */}
              <div className="flex flex-col justify-between gap-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">URL de la Imagen</label>
                    <input 
                      value={banner.imageUrl} 
                      onChange={(e) => onBannerChange(banner.id, { imageUrl: e.target.value })} 
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none focus:border-primary text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Orden</label>
                    <input 
                      type="number" 
                      min="0"
                      value={banner.order} 
                      onChange={(e) => onBannerChange(banner.id, { order: Number(e.target.value) })} 
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none focus:border-primary text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Título</label>
                    <input 
                      value={banner.title || ''} 
                      onChange={(e) => onBannerChange(banner.id, { title: e.target.value })} 
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none focus:border-primary text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Subtítulo</label>
                    <input 
                      value={banner.subtitle || ''} 
                      onChange={(e) => onBannerChange(banner.id, { subtitle: e.target.value })} 
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none focus:border-primary text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Texto del Botón</label>
                    <input 
                      value={banner.buttonText || ''} 
                      onChange={(e) => onBannerChange(banner.id, { buttonText: e.target.value })} 
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none focus:border-primary text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Vista de Destino</label>
                    <select
                      value={banner.linkView || 'menu'}
                      onChange={(e) => onBannerChange(banner.id, { linkView: e.target.value })}
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
                    >
                      <option value="menu">Menú</option>
                      <option value="promos">Promociones</option>
                      <option value="rewards">Premios / Puntos</option>
                      <option value="profile">Mi Perfil</option>
                      <option value="branches">Sucursales</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-outline/30 pt-3">
                  <Button 
                    size="sm" 
                    onClick={() => onSaveBanner(banner)} 
                    disabled={isLoading || !banner.imageUrl} 
                    className="bg-primary/90 hover:bg-primary flex items-center gap-1.5"
                  >
                    <Save size={15} /> Guardar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onDeleteBanner(banner.id)} 
                    disabled={isLoading}
                    className="border-primary/50 text-primary hover:bg-primary/10 flex items-center gap-1.5"
                  >
                    <Trash2 size={15} /> Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <div className="bg-surface border border-outline rounded-xl p-8 text-center text-gray-500 font-semibold">
              No hay banners de inicio configurados. Crea uno arriba para que se muestre en la pantalla de inicio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE CONFIGURACION ---
interface SettingsAdminProps {
  adminKey: string;
  isLoading: boolean;
  onSaveSuccess: () => void;
  onSaveError: (err: string) => void;
}

export function SettingsAdmin({ adminKey, onSaveSuccess, onSaveError }: SettingsAdminProps) {
  const [facebookUrl, setFacebookUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [googleReviewsSanMarcosUrl, setGoogleReviewsSanMarcosUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSystemSettings()
      .then((data) => {
        if (!active) return;
        if (data.facebook_url) setFacebookUrl(data.facebook_url);
        if (data.whatsapp_number) setWhatsappNumber(data.whatsapp_number);
        if (data.google_reviews_url) setGoogleReviewsUrl(data.google_reviews_url);
        if (data.google_reviews_san_marcos_url) setGoogleReviewsSanMarcosUrl(data.google_reviews_san_marcos_url);
      })
      .catch((err) => console.error('Error al cargar configuraciones:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateAdminSystemSettings(adminKey, {
        facebook_url: facebookUrl,
        whatsapp_number: whatsappNumber,
        google_reviews_url: googleReviewsUrl,
        google_reviews_san_marcos_url: googleReviewsSanMarcosUrl,
      });
      onSaveSuccess();
    } catch (err: any) {
      onSaveError(err.message || 'No se pudo guardar.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border border-outline bg-surface p-6 shadow-md">
      <h2 className="text-xl font-bold mb-4 uppercase tracking-wide flex items-center gap-2">
        <Settings size={20} className="text-primary" />
        Configuraciones Generales
      </h2>
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Enlace de Facebook"
          placeholder="https://facebook.com/tupagina"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
        />
        <Input
          label="Número de WhatsApp o Enlace Directo"
          placeholder="Ej: +521234567890 o enlace completo"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
        />
        <Input
          label={`Enlace de Reseñas en Google Maps - ${veneciaReviewBranch.label}`}
          placeholder="https://search.google.com/local/writereview?placeid=..."
          value={googleReviewsUrl}
          onChange={(e) => setGoogleReviewsUrl(e.target.value)}
        />
        <Input
          label={`Enlace de Reseñas en Google Maps - ${sanMarcosReviewBranch.label}`}
          placeholder={buildGoogleReviewUrl(sanMarcosReviewBranch.fallbackPlaceId)}
          value={googleReviewsSanMarcosUrl}
          onChange={(e) => setGoogleReviewsSanMarcosUrl(e.target.value)}
        />
        <p className="text-[11px] text-gray-400">
          Nota: Si ingresas un número telefónico, por favor incluye el código de país sin el símbolo "+" (ej: 521234567890).
        </p>
        <div className="pt-2">
          <Button type="submit" className="w-full animate-pulse-glow" isLoading={isSaving}>
            <Save size={16} className="mr-2" /> Guardar Configuraciones
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- SUB-COMPONENTE RESEÑAS ---
interface FeedbackAdminProps {
  feedbacks: FeedbackItem[];
  isLoading: boolean;
}

export function FeedbackAdmin({ feedbacks, isLoading }: FeedbackAdminProps) {
  if (isLoading && feedbacks.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-4xl rounded-xl border border-outline bg-surface p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4 uppercase tracking-wide flex items-center gap-2">
          <Star size={20} className="text-[#F4B400]" fill="currentColor" />
          Reseñas y Comentarios Recibidos
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Listado de calificaciones hechas por los usuarios. Las opiniones de 1 a 3 estrellas se registran aquí para mejora interna.
        </p>

        <div className="overflow-x-auto rounded-xl border border-outline bg-background/50">
          <table className="w-full min-w-[700px] border-collapse text-sm text-left">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Calificación</th>
                <th className="p-4">Comentario / Opinión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/30">
              {feedbacks.map((fb) => (
                <tr key={fb.id} className="hover:bg-surface-hover/20 transition-colors">
                  <td className="p-4 text-xs font-medium text-gray-300">
                    {new Date(fb.createdAt).toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <Star
                          key={val}
                          size={14}
                          className={val <= fb.rating ? 'text-[#F4B400]' : 'text-gray-600'}
                          fill={val <= fb.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-white max-w-sm whitespace-pre-wrap">
                    {fb.comment || <span className="text-gray-500 italic">Sin comentarios</span>}
                  </td>
                </tr>
              ))}
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500 font-semibold">
                    No hay opiniones o comentarios registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
