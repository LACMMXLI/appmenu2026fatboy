import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Gift,
  Image,
  Inbox,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { GOOGLE_REVIEW_BRANCHES, buildGoogleReviewUrl } from '@/lib/googleReviews';
import {
  getSystemSettings,
  updateAdminSystemSettings,
  defaultProductImage,
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

/* ═══════════════════════════════════════════
   EMPTY STATE — Shared component
═══════════════════════════════════════════ */
function AdminEmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="admin-empty-pattern rounded-xl border border-dashed border-outline bg-surface p-8 text-center sm:p-12">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-outline bg-background text-gray-500">
        <Icon size={24} />
      </div>
      <p className="text-sm font-black uppercase tracking-wide text-white">{title}</p>
      <p className="mt-1 text-xs font-medium text-gray-400">{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION HEADER — Reusable banner with gradient
═══════════════════════════════════════════ */
function SectionHeader({ tag, title, subtitle, children }: { tag: string; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/40 pb-3.5 mb-1 shrink-0">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">{tag}</p>
        <h3 className="text-base font-black uppercase tracking-wide text-white mt-0.5">{title}</h3>
        {subtitle && <p className="text-xs font-medium text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

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
  isCreateOpen: boolean;
  setIsCreateOpen: (value: boolean) => void;
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
  isCreateOpen,
  setIsCreateOpen,
}: ProductsAdminProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
    <div className="space-y-4">

      {/* Product Grid */}
      <motion.div
        layout
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 rounded-xl border border-outline bg-background/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <AnimatePresence initial={false}>
          {products.map((product, index) => (
            <motion.article
              key={product.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.08) }}
              className="admin-card-hover group relative flex flex-col justify-between rounded-xl border border-outline bg-surface/95 p-3.5 shadow-lg hover:border-primary/35"
            >
              <div>
                {/* Product Image */}
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-outline/30 bg-background mb-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = defaultProductImage;
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-600">
                      <Image size={24} />
                    </div>
                  )}
                  
                  {/* Status Overlay Badge */}
                  <div className="absolute top-2 right-2">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md",
                      product.status === 'active'
                        ? "bg-green-500/15 text-green-300 border-green-500/35"
                        : "bg-primary/15 text-primary border-primary/35"
                    )}>
                      {product.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />}
                      {product.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Identity Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary truncate">
                      {product.category.name}
                    </span>
                    <span className="text-sm font-bold text-gold shrink-0">
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </div>
                  <h4 className="mt-1 font-sans text-sm font-bold text-white truncate group-hover:text-gold transition-colors">
                    {product.name || 'Producto sin nombre'}
                  </h4>
                  <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 min-h-[2rem] leading-relaxed">
                    {product.description || <span className="italic text-gray-600">Sin descripción</span>}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2 border-t border-outline/20 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setEditingProduct(product)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => onDeleteProduct(product)}
                >
                  Eliminar
                </Button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>

        {products.length === 0 && (
          <div className="col-span-full">
            <AdminEmptyState
              icon={ShoppingBag}
              title="Sin productos visibles"
              description="Cambia la categoria o la busqueda para ver mas resultados."
            />
          </div>
        )}
      </motion.div>

      {/* Create Product Modal */}
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
              className="admin-gradient-border max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            >
              <div className="sticky top-0 z-10 border-b border-outline bg-surface/95 px-5 py-4 backdrop-blur rounded-t-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Alta de producto</p>
                  <h3 className="text-xl font-black uppercase tracking-wide text-white">Nuevo producto</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid gap-4 bg-surface p-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl border border-outline bg-background">
                  <div className="aspect-square">
                    {newProduct.imageUrl ? (
                      <img src={newProduct.imageUrl} alt={newProduct.name || 'Nuevo producto'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="admin-skeleton flex h-full w-full items-center justify-center">
                        <Image size={34} className="text-gray-600 relative z-10" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <Input label="Nombre *" value={newProduct.name} onChange={(event) => onNewProductChange({ ...newProduct, name: event.target.value })} autoFocus className="h-10 px-3 text-sm" />
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Input label="Precio" type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => onNewProductChange({ ...newProduct, price: Number(event.target.value) })} className="h-10 px-3 text-sm font-bold" />
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Categoría *
                      <select
                         value={newProduct.categoryId || activeCategories[0]?.id || ''}
                         onChange={(event) => onNewProductChange({ ...newProduct, categoryId: event.target.value })}
                         className="h-10 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none transition-colors focus:border-primary"
                      >
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Input label="URL imagen" value={newProduct.imageUrl} onChange={(event) => onNewProductChange({ ...newProduct, imageUrl: event.target.value })} placeholder="https://..." className="h-10 px-3 text-sm" />
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Descripción
                    <textarea
                      value={newProduct.description}
                      onChange={(event) => onNewProductChange({ ...newProduct, description: event.target.value })}
                      className="min-h-[110px] w-full resize-y rounded-lg border border-outline bg-background px-4 py-3 text-sm leading-5 text-white outline-none transition-colors focus:border-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-outline bg-surface px-5 py-4 rounded-b-2xl">
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

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Editar ${editingProduct.name}`}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="admin-gradient-border max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            >
              <div className="sticky top-0 z-10 border-b border-outline bg-surface/95 px-5 py-4 backdrop-blur rounded-t-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Modificación de producto</p>
                  <h3 className="text-xl font-black uppercase tracking-wide text-white">Editar producto</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid gap-4 bg-surface p-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl border border-outline bg-background">
                  <div className="aspect-square">
                    {editingProduct.imageUrl ? (
                      <img
                        src={editingProduct.imageUrl}
                        alt={editingProduct.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = defaultProductImage;
                        }}
                      />
                    ) : (
                      <div className="admin-skeleton flex h-full w-full items-center justify-center">
                        <Image size={34} className="text-gray-600 relative z-10" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <Input
                    label="Nombre *"
                    value={editingProduct.name}
                    onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })}
                    className="h-10 px-3 text-sm"
                  />
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Input
                      label="Precio"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingProduct.price}
                      onChange={(event) => setEditingProduct({ ...editingProduct, price: Number(event.target.value) })}
                      className="h-10 px-3 text-sm font-bold"
                    />
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Categoría *
                      <select
                        value={editingProduct.categoryId}
                        onChange={(event) => setEditingProduct({ ...editingProduct, categoryId: event.target.value })}
                        className="h-10 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none transition-colors focus:border-primary"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Input
                      label="URL imagen"
                      value={editingProduct.imageUrl ?? ''}
                      onChange={(event) => setEditingProduct({ ...editingProduct, imageUrl: event.target.value })}
                      placeholder="https://..."
                      className="h-10 px-3 text-sm"
                    />
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Estado
                      <select
                        value={editingProduct.status}
                        onChange={(event) => setEditingProduct({ ...editingProduct, status: event.target.value as 'active' | 'inactive' })}
                        className="h-10 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none transition-colors focus:border-primary"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Descripción
                    <textarea
                      value={editingProduct.description ?? ''}
                      onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })}
                      className="min-h-[110px] w-full resize-y rounded-lg border border-outline bg-background px-4 py-3 text-sm leading-5 text-white outline-none transition-colors focus:border-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-outline bg-surface px-5 py-4 rounded-b-2xl">
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!editingProduct.name) return;
                    await onSaveProduct(editingProduct);
                    setEditingProduct(null);
                  }}
                  disabled={isLoading || !editingProduct.name}
                >
                  <Save size={16} className="mr-2" /> Guardar cambios
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
  onCancelChanges: () => void;
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
  onCancelChanges,
  onDeleteCategory,
}: CategoriesAdminProps) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Create form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.2fr)_auto]"
      >
        <Input label="Nueva categoría" value={newCategory.name} onChange={(event) => onNewCategoryChange({ ...newCategory, name: event.target.value })} className="h-10 px-3 text-sm" />
        <Input label="Orden" type="number" min="0" value={newCategory.order} onChange={(event) => onNewCategoryChange({ ...newCategory, order: Number(event.target.value) })} className="h-10 px-3 text-sm font-semibold" />
        <Input label="URL imagen" value={newCategory.imageUrl} onChange={(event) => onNewCategoryChange({ ...newCategory, imageUrl: event.target.value })} className="h-10 px-3 text-sm" />
        <Button size="sm" className="self-end md:col-span-3 xl:col-span-1 h-10 px-4 text-xs font-bold uppercase tracking-wider" onClick={onCreateCategory} disabled={isLoading || !newCategory.name}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
      </motion.div>

      {/* Table with max height and sticky headers */}
      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md max-h-[500px] overflow-y-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur text-xs uppercase tracking-wider text-gray-400">
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
            {categories.map((category, index) => {
              const isEditing = editingCategoryId === category.id;

              return (
                <motion.tr
                  key={category.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.1), duration: 0.2 }}
                  className={cn(
                    'admin-row-hover border-t border-outline/50 transition-colors align-middle',
                    index % 2 === 1 && 'bg-surface/30',
                  )}
                >
                  {/* Category Name */}
                  <td className="p-3">
                    {isEditing ? (
                      <input
                        value={category.name}
                        onChange={(event) => onCategoryChange(category.id, { name: event.target.value })}
                        className="h-9 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white text-sm"
                      />
                    ) : (
                      <span className="font-sans font-bold text-white text-sm px-1.5">{category.name}</span>
                    )}
                  </td>

                  {/* Order */}
                  <td className="p-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={category.order}
                        onChange={(event) => onCategoryChange(category.id, { order: Number(event.target.value) })}
                        className="h-9 w-24 rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white font-semibold text-sm"
                      />
                    ) : (
                      <span className="text-gray-300 font-semibold px-2">{category.order}</span>
                    )}
                  </td>

                  {/* Image Preview & URL */}
                  <td className="p-3">
                    {isEditing ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-outline bg-background">
                          {category.imageUrl ? (
                            <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-600">
                              <Image size={15} />
                            </div>
                          )}
                        </div>
                        <input
                          value={category.imageUrl ?? ''}
                          onChange={(event) => onCategoryChange(category.id, { imageUrl: event.target.value })}
                          placeholder="https://..."
                          className="h-9 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white text-xs"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-outline bg-background">
                          {category.imageUrl ? (
                            <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-600">
                              <Image size={15} />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 truncate max-w-[200px] font-sans">
                          {category.imageUrl || <span className="italic text-gray-600">Sin imagen</span>}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Products Count */}
                  <td className="p-3 text-gray-300 font-semibold text-sm">{category._count?.products ?? 0}</td>

                  {/* Status Toggle */}
                  <td className="p-3">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => onCategoryChange(category.id, { status: category.status === 'active' ? 'inactive' : 'active' })}
                        className={cn(
                          'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold uppercase transition-all duration-200',
                          category.status === 'active'
                            ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                            : 'bg-primary/15 text-primary border border-primary/30',
                        )}
                      >
                        {category.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />}
                        {category.status === 'active' ? 'Activa' : 'Inactiva'}
                      </button>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        category.status === 'active'
                          ? 'bg-green-500/15 text-green-300 border-green-500/30'
                          : 'bg-primary/15 text-primary border-primary/30'
                      )}>
                        {category.status === 'active' ? 'Activa' : 'Inactiva'}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            onSaveCategory(category);
                            setEditingCategoryId(null);
                          }}
                          disabled={isLoading}
                          className="bg-green-600 hover:bg-green-700 h-8 px-2.5 flex items-center justify-center"
                          title="Guardar"
                        >
                          <Save size={14} className="mr-1" /> Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onCancelChanges();
                            setEditingCategoryId(null);
                          }}
                          disabled={isLoading}
                          className="h-8 px-2.5"
                          title="Cancelar"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCategoryId(category.id)}
                          className="h-8 px-3"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteCategory(category)}
                          disabled={isLoading}
                          className="border-primary/45 text-primary hover:bg-primary/10 h-8 px-2.5 flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              );
            })}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <AdminEmptyState icon={Package} title="Sin categorías" description="Crea tu primera categoría para empezar a organizar productos." />
                </td>
              </tr>
            )}
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-outline p-4 rounded-xl">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Administrar Promociones</h3>
        <p className="text-xs text-gray-400">Marca productos como promociones y especifica sus etiquetas promocionales que verán los usuarios.</p>
      </motion.div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur text-xs uppercase tracking-wider text-gray-400">
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
            {products.map((product, index) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                className={cn(
                  'admin-row-hover border-t border-outline/50 transition-colors',
                  index % 2 === 1 && 'bg-surface/30',
                )}
              >
                <td className="p-3 font-semibold text-white">{product.name}</td>
                <td className="p-3 text-gold font-bold">${product.price}</td>
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
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] disabled:opacity-40 text-white"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={product.promotionTagColor || 'red'}
                    disabled={!product.isPromotion}
                    onChange={(e) => onProductChange(product.id, { promotionTagColor: e.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary disabled:opacity-40 text-white"
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
              </motion.tr>
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-outline bg-surface p-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Gift size={16} className="text-gold" /> Productos canjeables
        </h3>
        <p className="text-xs text-gray-400">
          Configura productos únicos para puntos. Solo los activos aparecen en la vista de recompensas del cliente.
        </p>
      </motion.div>

      <div className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[minmax(0,1.1fr)_120px_minmax(0,1.2fr)_90px] xl:grid-cols-[minmax(0,1.1fr)_120px_minmax(0,1.2fr)_90px_auto]">
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
        <Button className="self-end animate-pulse-glow md:col-span-4 xl:col-span-1" onClick={onCreateProduct} disabled={isLoading || !newProduct.name}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
        <div className="md:col-span-4 xl:col-span-5">
          <Input
            label="Descripción"
            value={newProduct.description}
            onChange={(event) => onNewProductChange({ ...newProduct, description: event.target.value })}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur text-xs uppercase tracking-wider text-gray-400">
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
            {products.map((product, index) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                className={cn(
                  'admin-row-hover border-t border-outline/50 transition-colors',
                  index % 2 === 1 && 'bg-surface/30',
                )}
              >
                <td className="p-2">
                  <input
                    value={product.name}
                    onChange={(event) => onProductChange(product.id, { name: event.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={product.pointsCost}
                    onChange={(event) => onProductChange(product.id, { pointsCost: Number(event.target.value) })}
                    className="h-10 w-28 rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-gold font-bold"
                  />
                </td>
                <td className="p-2">
                  <div className="flex min-w-0 items-center gap-2">
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
                      className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-white text-xs"
                    />
                  </div>
                </td>
                <td className="p-2">
                  <input
                    value={product.description ?? ''}
                    onChange={(event) => onProductChange(product.id, { description: event.target.value })}
                    className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-white"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    value={product.order}
                    onChange={(event) => onProductChange(product.id, { order: Number(event.target.value) })}
                    className="h-10 w-24 rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-white font-semibold"
                  />
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => onProductChange(product.id, { status: product.status === 'active' ? 'inactive' : 'active' })}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold uppercase transition-all duration-200',
                      product.status === 'active'
                        ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                        : 'bg-primary/15 text-primary border border-primary/30',
                    )}
                  >
                    {product.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse-dot" />}
                    {product.status === 'active' ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => onSaveProduct(product)} disabled={isLoading} className="bg-primary/90 hover:bg-primary"><Save size={15} /></Button>
                    <Button size="sm" variant="outline" onClick={() => onDeleteProduct(product)} disabled={isLoading}><Trash2 size={15} /></Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <AdminEmptyState icon={Gift} title="Sin productos canjeables" description="Configura productos canjeables para el programa de recompensas." />
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

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Teléfono</th>
              <th className="p-3 text-left">Puntos Acumulados</th>
              <th className="p-3 text-left">Fecha Registro</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((cust, index) => (
              <motion.tr
                key={cust.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                className={cn(
                  'admin-row-hover border-t border-outline/50 transition-colors',
                  index % 2 === 1 && 'bg-surface/30',
                )}
              >
                <td className="p-2">
                  <input value={cust.name} onChange={(event) => onCustomerChange(cust.id, { name: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white" />
                </td>
                <td className="p-2">
                  <input value={cust.phone} onChange={(event) => onCustomerChange(cust.id, { phone: event.target.value })} className="h-10 w-44 rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-white font-semibold" />
                </td>
                <td className="p-2">
                  <input type="number" min="0" value={cust.points} onChange={(event) => onCustomerChange(cust.id, { points: Number(event.target.value) })} className="h-10 w-28 rounded-md border border-outline bg-background px-3 outline-none transition-colors focus:border-primary text-gold font-bold" />
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
              </motion.tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <AdminEmptyState icon={Inbox} title="Sin clientes" description="No se encontraron clientes con los filtros actuales." />
                </td>
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
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'preparing': return Flame;
      case 'delivered': return CheckCircle2;
      case 'cancelled': return X;
      default: return AlertCircle;
    }
  };

  const getOrderBorderClass = (status: string) => {
    switch (status) {
      case 'pending': return 'admin-order-pending';
      case 'preparing': return 'admin-order-preparing';
      case 'delivered': return 'admin-order-delivered';
      case 'cancelled': return 'admin-order-cancelled';
      default: return '';
    }
  };

  // Progress timeline steps
  const STEPS = ['pending', 'preparing', 'delivered'];
  const getStepIndex = (status: string) => {
    const idx = STEPS.indexOf(status);
    return idx === -1 ? -1 : idx;
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {orders.map((order, index) => {
            const shortId = order.id.substring(0, 8).toUpperCase();
            const isExpanded = expandedOrders.has(order.id);
            const StatusIcon = getStatusIcon(order.status);
            const currentStep = getStepIndex(order.status);

            const itemsList = order.items.map(i => {
              const extText = i.extras ? ` (Extras: ${JSON.parse(i.extras).map((e: any) => e.name).join(', ')})` : '';
              const remText = i.removals ? ` (Sin: ${JSON.parse(i.removals).join(', ')})` : '';
              const prepText = i.meatPrep ? ` [${i.meatPrep}]` : '';
              return `${i.quantity}x ${i.productName}${prepText}${extText}${remText}`;
            });

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.12) }}
                className={cn(
                  'admin-card-hover bg-surface border border-outline rounded-xl p-5 shadow-lg',
                  getOrderBorderClass(order.status),
                )}
              >
                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-outline/30 pb-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-display text-lg tracking-wider text-white">PEDIDO #{shortId}</span>
                      <span className={cn('flex items-center gap-1 text-xs font-bold border px-2 py-0.5 rounded-full uppercase', getStatusBadgeClass(order.status))}>
                        <StatusIcon size={12} />
                        {getStatusLabel(order.status)}
                        {(order.status === 'pending' || order.status === 'preparing') && (
                          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        )}
                      </span>
                    </div>
                    <span className="mt-0.5 block break-words text-xs text-gray-400">Fatboy {order.branchName} - {new Date(order.createdAt).toLocaleString()}</span>

                    {/* Progress Timeline */}
                    {order.status !== 'cancelled' && (
                      <div className="flex items-center gap-1 mt-2.5">
                        {STEPS.map((step, i) => (
                          <React.Fragment key={step}>
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full transition-colors duration-300',
                                i <= currentStep ? 'bg-green' : 'bg-gray-600',
                                i === currentStep && 'ring-2 ring-green/30',
                              )}
                            />
                            {i < STEPS.length - 1 && (
                              <div className={cn('h-0.5 w-6 rounded-full transition-colors duration-300', i < currentStep ? 'bg-green' : 'bg-gray-700')} />
                            )}
                          </React.Fragment>
                        ))}
                        <span className="ml-2 text-[10px] font-bold text-gray-500 uppercase">
                          {order.status === 'delivered' ? 'Completado' : `Paso ${currentStep + 1}/3`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-gray-500 block uppercase tracking-widest leading-none">TOTAL</span>
                      <span className="font-display text-2xl text-gold font-bold bg-gradient-to-r from-gold to-gold-dark bg-clip-text">${order.total}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {order.status === 'pending' && (
                        <Button size="sm" onClick={() => onUpdateStatus(order.id, 'preparing')} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">Aceptar / Cocinar</Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button size="sm" onClick={() => onUpdateStatus(order.id, 'delivered')} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                          <Truck size={14} className="mr-1.5" /> Entregar
                        </Button>
                      )}
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(order.id, 'cancelled')} disabled={isLoading} className="border-primary/50 text-primary hover:bg-primary/10">Cancelar</Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Cliente</span>
                    <p className="font-semibold text-white text-sm">{order.customerName}</p>
                    <p className="text-xs text-gray-400">{order.customerPhone}</p>
                    {order.notes && <p className="text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/10 p-2 rounded mt-2">Nota: {order.notes}</p>}
                  </div>

                  <div className="space-y-1">
                    {/* Collapsible items */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
                    >
                      Ítems ({order.items.reduce((a, b) => a + b.quantity, 0)})
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <ul className="text-xs text-gray-300 list-disc pl-4 space-y-1 font-semibold">
                            {itemsList.map((item, idx) => (
                              <li key={idx} className="hover:text-white transition-colors">{item}</li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-3 flex flex-wrap gap-4 border-t border-outline/10 pt-2 text-[11px] font-semibold text-gray-400">
                      {order.pointsRedeemed > 0 && <span>Puntos Redimidos: <strong className="text-primary">{order.pointsRedeemed} pts</strong></span>}
                      {order.pointsEarned > 0 && <span>Puntos Ganados: <strong className="text-gold">{order.pointsEarned} pts</strong></span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {orders.length === 0 && (
          <AdminEmptyState icon={Inbox} title="Sin pedidos" description="No se encontraron pedidos con los filtros actuales." />
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
      {/* Create form */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="admin-premium-panel space-y-4 rounded-xl border border-outline p-5 shadow-lg">
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
              className="h-10 rounded-md border border-outline bg-background px-3 text-sm text-white outline-none transition-colors focus:border-primary"
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
      </motion.div>

      {/* Banner list */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
          Banners de Inicio Activos ({banners.length})
        </h3>

        <div className="grid gap-6">
          <AnimatePresence initial={false}>
            {banners.map((banner, index) => (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                className="admin-card-hover grid min-w-0 gap-5 rounded-xl border border-outline bg-surface p-4 shadow-lg md:grid-cols-[160px_minmax(0,1fr)] xl:p-5"
              >
                {/* Image preview */}
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-outline/30 bg-black md:aspect-square">
                  {banner.imageUrl ? (
                    <img 
                      src={banner.imageUrl} 
                      alt={banner.title || 'Vista previa'} 
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                  ) : (
                    <div className="admin-skeleton flex h-full w-full items-center justify-center">
                      <Image size={32} className="text-gray-600 relative z-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-left">
                    <span className="font-display text-lg tracking-wider text-white uppercase truncate">{banner.title || 'SIN TÍTULO'}</span>
                    <span className="text-[10px] text-gold uppercase tracking-widest font-bold font-sans truncate">{banner.subtitle || 'Sin subtítulo'}</span>
                  </div>
                </div>

                {/* Edit fields */}
                <div className="flex min-w-0 flex-col justify-between gap-4">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">URL de la Imagen</label>
                      <input 
                        value={banner.imageUrl} 
                        onChange={(e) => onBannerChange(banner.id, { imageUrl: e.target.value })} 
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:shadow-[0_0_8px_rgba(232,0,10,0.12)] text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Orden</label>
                      <input 
                        type="number" 
                        min="0"
                        value={banner.order} 
                        onChange={(e) => onBannerChange(banner.id, { order: Number(e.target.value) })} 
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none transition-colors focus:border-primary text-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Título</label>
                      <input 
                        value={banner.title || ''} 
                        onChange={(e) => onBannerChange(banner.id, { title: e.target.value })} 
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none transition-colors focus:border-primary text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Subtítulo</label>
                      <input 
                        value={banner.subtitle || ''} 
                        onChange={(e) => onBannerChange(banner.id, { subtitle: e.target.value })} 
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none transition-colors focus:border-primary text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Texto del Botón</label>
                      <input 
                        value={banner.buttonText || ''} 
                        onChange={(e) => onBannerChange(banner.id, { buttonText: e.target.value })} 
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm outline-none transition-colors focus:border-primary text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Vista de Destino</label>
                      <select
                        value={banner.linkView || 'menu'}
                        onChange={(e) => onBannerChange(banner.id, { linkView: e.target.value })}
                        className="h-10 w-full rounded-md border border-outline bg-background px-3 text-sm text-white outline-none transition-colors focus:border-primary"
                      >
                        <option value="menu">Menú</option>
                        <option value="promos">Promociones</option>
                        <option value="rewards">Premios / Puntos</option>
                        <option value="profile">Mi Perfil</option>
                        <option value="branches">Sucursales</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-outline/30 pt-3">
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
              </motion.div>
            ))}
          </AnimatePresence>

          {banners.length === 0 && (
            <AdminEmptyState icon={Image} title="Sin banners" description="Crea tu primer banner para que se muestre en la pantalla de inicio." />
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="admin-premium-panel mx-auto w-full max-w-3xl rounded-xl border border-outline p-6 shadow-md">
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
          <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary shadow-[0_0_15px_rgba(232,0,10,0.2)] transition-all duration-300" isLoading={isSaving}>
            <Save size={16} className="mr-2" /> Guardar Configuraciones
          </Button>
        </div>
      </form>
    </motion.div>
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-5xl rounded-xl border border-outline bg-surface p-5 shadow-md sm:p-6">
        <h2 className="text-xl font-bold mb-4 uppercase tracking-wide flex items-center gap-2">
          <Star size={20} className="text-[#F4B400]" fill="currentColor" />
          Reseñas y Comentarios Recibidos
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Listado de calificaciones hechas por los usuarios. Las opiniones de 1 a 3 estrellas se registran aquí para mejora interna.
        </p>

        <div className="overflow-x-auto rounded-xl border border-outline bg-background/50">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Calificación</th>
                <th className="p-4">Comentario / Opinión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/30">
              {feedbacks.map((fb, index) => (
                <motion.tr
                  key={fb.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  className={cn(
                    'admin-row-hover transition-colors',
                    index % 2 === 1 && 'bg-surface/20',
                  )}
                >
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
                          className={cn(
                            'transition-colors',
                            val <= fb.rating ? 'text-[#F4B400]' : 'text-gray-600',
                          )}
                          fill={val <= fb.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-white max-w-sm whitespace-pre-wrap">
                    {fb.comment || <span className="text-gray-500 italic">Sin comentarios</span>}
                  </td>
                </motion.tr>
              ))}
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <AdminEmptyState icon={Star} title="Sin reseñas" description="No hay opiniones o comentarios registrados todavía." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
