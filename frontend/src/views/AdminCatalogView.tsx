import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Plus, RefreshCw, Save, Search, Trash2, Tag, Users, FileText, ShoppingBag, Store, Image, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  deleteAdminProduct,
  getAdminCatalog,
  type AdminCatalog,
  type Category,
  type Product,
  updateAdminCategory,
  updateAdminProduct,
  // Nuevas APIs
  getAdminCustomers,
  updateAdminCustomerPoints,
  updateAdminCustomer,
  deleteAdminCustomer,
  getAdminOrders,
  updateAdminOrderStatus,
  getBranches,
  // Banners
  getHomeBanners,
  createAdminHomeBanner,
  updateAdminHomeBanner,
  deleteAdminHomeBanner,
  type HomeBanner,
  type Branch,
  type Customer,
  type Order,
  getSystemSettings,
  updateAdminSystemSettings,
  getAdminFeedback,
  type FeedbackItem
} from '@/lib/api';

type Tab = 'products' | 'categories' | 'promotions' | 'customers' | 'orders' | 'banners' | 'settings' | 'feedback';



const emptyProduct = {
  name: '',
  price: 0,
  categoryId: '',
  description: '',
};

export function AdminCatalogView() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('fatboy-admin-key') ?? '');
  const [catalog, setCatalog] = useState<AdminCatalog>({ categories: [], products: [] });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderBranchFilter, setOrderBranchFilter] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [newCategory, setNewCategory] = useState({ name: '', order: 999 });
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [newBanner, setNewBanner] = useState({ imageUrl: '', title: '', subtitle: '', buttonText: '', linkView: 'menu', order: 999 });

  const activeCategories = useMemo(
    () => catalog.categories.filter((category) => category.status === 'active'),
    [catalog.categories],
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalog.products;
    return catalog.products.filter((product) => {
      return (
        product.name.toLowerCase().includes(term) ||
        product.category.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.shortDescription?.toLowerCase().includes(term)
      );
    });
  }, [catalog.products, search]);

  useEffect(() => {
    if (adminKey) {
      refreshAll(adminKey);
    }
  }, []);

  async function refreshAll(key = adminKey) {
    try {
      setIsLoading(true);
      setError('');
      
      // Cargar catálogo de admin
      const catResponse = await getAdminCatalog(key);
      setCatalog(catResponse);
      
      setNewProduct((current) => ({
        ...current,
        categoryId: current.categoryId || catResponse.categories[0]?.id || '',
      }));

      // Cargar sucursales
      const branchesList = await getBranches();
      setBranches(branchesList);

      // Cargar clientes
      const customersList = await getAdminCustomers(key);
      setCustomers(customersList);

      // Cargar pedidos
      const ordersList = await getAdminOrders(key);
      setOrders(ordersList);

      // Cargar banners
      const bannersList = await getHomeBanners();
      setBanners(bannersList);

      // Cargar feedback
      const feedbacksList = await getAdminFeedback(key);
      setFeedbacks(feedbacksList);


      setIsAuthorized(true);
      sessionStorage.setItem('fatboy-admin-key', key);
    } catch (err) {
      setIsAuthorized(false);
      setError(err instanceof Error ? err.message : 'No se pudo abrir el panel.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAll(adminKey);
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      await action();
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setIsLoading(false);
    }
  }

  // --- PRODUCTOS ---
  function updateLocalProduct(id: string, patch: Partial<Product>) {
    setCatalog((current) => ({
      ...current,
      products: current.products.map((product) => (product.id === id ? { ...product, ...patch } : product)),
    }));
  }

  async function saveProduct(product: Product) {
    await runAction(async () => {
      await updateAdminProduct(adminKey, product.id, {
        name: product.name,
        price: product.price,
        categoryId: product.categoryId,
        status: product.status,
        description: product.description,
        shortDescription: product.shortDescription,
        imageUrl: product.imageUrl,
        isPromotion: product.isPromotion,
        promotionTag: product.promotionTag,
        promotionTagColor: product.promotionTagColor,
      });
      await refreshAll();
    }, 'Producto guardado.');
  }

  async function createProduct() {
    await runAction(async () => {
      await createAdminProduct(adminKey, {
        name: newProduct.name,
        price: newProduct.price,
        categoryId: newProduct.categoryId,
        description: newProduct.description,
      });
      setNewProduct({ ...emptyProduct, categoryId: catalog.categories[0]?.id || '' });
      await refreshAll();
    }, 'Producto creado.');
  }

  // --- CATEGORIAS ---
  function updateLocalCategory(id: string, patch: Partial<Category>) {
    setCatalog((current) => ({
      ...current,
      categories: current.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
      products: current.products.map((product) =>
        product.categoryId === id ? { ...product, category: { ...product.category, ...patch } } : product,
      ),
    }));
  }

  async function saveCategory(category: Category) {
    await runAction(async () => {
      await updateAdminCategory(adminKey, category.id, {
        name: category.name,
        order: category.order,
        status: category.status,
      });
      await refreshAll();
    }, 'Categoría guardada.');
  }

  async function createCategory() {
    await runAction(async () => {
      await createAdminCategory(adminKey, newCategory);
      setNewCategory({ name: '', order: 999 });
      await refreshAll();
    }, 'Categoría creada.');
  }

  // --- CLIENTES ---
  async function searchCustomers() {
    try {
      setIsLoading(true);
      const list = await getAdminCustomers(adminKey, customerSearch);
      setCustomers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar clientes.');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveCustomer(cust: Customer) {
    await runAction(async () => {
      await updateAdminCustomer(adminKey, cust.id, {
        name: cust.name,
        phone: cust.phone,
      });
      await updateAdminCustomerPoints(adminKey, cust.id, cust.points);
      await refreshAll();
    }, 'Cliente actualizado.');
  }

  async function deleteCustomerAction(id: string, name: string) {
    if (!window.confirm(`¿Seguro que deseas eliminar al cliente "${name}"?`)) return;
    await runAction(async () => {
      await deleteAdminCustomer(adminKey, id);
      await refreshAll();
    }, 'Cliente eliminado.');
  }

  // --- PEDIDOS ---
  async function updateOrderStatus(orderId: string, status: string) {
    await runAction(async () => {
      await updateAdminOrderStatus(adminKey, orderId, status);
      await refreshAll();
    }, 'Estado del pedido actualizado.');
  }

  const filteredOrders = useMemo(() => {
    if (!orderBranchFilter) return orders;
    return orders.filter(o => o.branchId === orderBranchFilter);
  }, [orders, orderBranchFilter]);

  if (!isAuthorized) {
    return (
      <main className="min-h-[100dvh] bg-background text-white flex items-center justify-center px-5">
        <form onSubmit={handleUnlock} className="w-full max-w-sm rounded-xl border border-outline bg-surface p-5 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <KeyRound size={22} />
            </div>
            <div>
              <h1 className="font-display text-3xl leading-none">ADMINISTRACIÓN</h1>
              <p className="text-xs text-gray-400">Control total del restaurante Fatboy.</p>
            </div>
          </div>
          <Input
            label="Clave administrativa"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            autoFocus
          />
          {error && <p className="mt-3 text-sm text-primary">{error}</p>}
          <Button type="submit" className="mt-5 w-full" isLoading={isLoading}>
            Entrar
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background text-white pb-12">
      <header className="sticky top-0 z-20 border-b border-outline bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-4xl leading-none tracking-wide">FATBOY ADMIN</h1>
            <p className="text-xs text-gray-400">Panel administrativo global.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshAll()} isLoading={isLoading}>
            <RefreshCw size={16} className="mr-2" /> Actualizar
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-4">
        {/* Tabs navigation */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-outline pb-4">
          {[
            { id: 'products', label: 'Productos', count: catalog.products.length, icon: ShoppingBag },
            { id: 'categories', label: 'Categorías', count: catalog.categories.length, icon: Store },
            { id: 'promotions', label: 'Promociones', count: catalog.products.filter(p => p.isPromotion).length, icon: Tag },
            { id: 'banners', label: 'Banners Inicio', count: banners.length, icon: Image },
            { id: 'customers', label: 'Clientes', count: customers.length, icon: Users },
            { id: 'orders', label: 'Pedidos', count: orders.length, icon: FileText },
            { id: 'settings', label: 'Configuración', count: 3, icon: Settings },
            { id: 'feedback', label: 'Reseñas', count: feedbacks.length, icon: Star },
          ].map((tab) => (


            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                'h-10 rounded-lg px-4 text-xs font-bold uppercase flex items-center gap-2 transition-all border',
                activeTab === tab.id 
                  ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(229,9,20,0.3)]' 
                  : 'bg-surface border-outline text-gray-400 hover:text-white'
              )}
            >
              <tab.icon size={14} />
              {tab.label} ({tab.count})
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {message && <span className="flex items-center gap-1 text-sm text-green-400 animate-fade-in"><Check size={16} /> {message}</span>}
            {error && <span className="text-sm text-primary animate-fade-in">{error}</span>}
          </div>
        </div>

        {/* Tab contents */}
        {activeTab === 'products' && (
          <ProductsAdmin
            categories={catalog.categories}
            activeCategories={activeCategories}
            products={visibleProducts}
            search={search}
            newProduct={newProduct}
            isLoading={isLoading}
            onSearch={setSearch}
            onNewProductChange={setNewProduct}
            onCreateProduct={createProduct}
            onProductChange={updateLocalProduct}
            onSaveProduct={saveProduct}
            onDeleteProduct={(product) =>
              runAction(async () => {
                if (!window.confirm(`Eliminar producto "${product.name}"?`)) return;
                await deleteAdminProduct(adminKey, product.id);
                await refreshAll();
              }, 'Producto eliminado.')
            }
          />
        )}

        {activeTab === 'banners' && (
          <BannersAdmin
            banners={banners}
            newBanner={newBanner}
            isLoading={isLoading}
            onNewBannerChange={setNewBanner}
            onCreateBanner={async () => {
              await runAction(async () => {
                await createAdminHomeBanner(adminKey, {
                  ...newBanner,
                  order: Number(newBanner.order),
                });
                setNewBanner({ imageUrl: '', title: '', subtitle: '', buttonText: '', linkView: 'menu', order: 999 });
                await refreshAll();
              }, 'Banner de inicio creado.');
            }}
            onBannerChange={(id, patch) => {
              setBanners(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
            }}
            onSaveBanner={async (banner) => {
              await runAction(async () => {
                await updateAdminHomeBanner(adminKey, banner.id, {
                  imageUrl: banner.imageUrl,
                  title: banner.title,
                  subtitle: banner.subtitle,
                  buttonText: banner.buttonText,
                  linkView: banner.linkView,
                  order: Number(banner.order),
                });
                await refreshAll();
              }, 'Banner guardado.');
            }}
            onDeleteBanner={async (id) => {
              if (!window.confirm('¿Eliminar este banner de la pantalla de inicio?')) return;
              await runAction(async () => {
                await deleteAdminHomeBanner(adminKey, id);
                await refreshAll();
              }, 'Banner eliminado.');
            }}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesAdmin
            categories={catalog.categories}
            newCategory={newCategory}
            isLoading={isLoading}
            onNewCategoryChange={setNewCategory}
            onCreateCategory={createCategory}
            onCategoryChange={updateLocalCategory}
            onSaveCategory={saveCategory}
            onDeleteCategory={(category) =>
              runAction(async () => {
                if (!window.confirm(`Eliminar categoría "${category.name}"?`)) return;
                await deleteAdminCategory(adminKey, category.id);
                await refreshAll();
              }, 'Categoría eliminada.')
            }
          />
        )}

        {activeTab === 'promotions' && (
          <PromotionsAdmin 
            products={catalog.products}
            isLoading={isLoading}
            onProductChange={updateLocalProduct}
            onSaveProduct={saveProduct}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersAdmin
            customers={customers}
            search={customerSearch}
            isLoading={isLoading}
            onSearchChange={setCustomerSearch}
            onSearchSubmit={searchCustomers}
            onCustomerChange={(id, patch) => {
              setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
            }}
            onSaveCustomer={saveCustomer}
            onDeleteCustomer={deleteCustomerAction}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersAdmin
            orders={filteredOrders}
            branches={branches}
            branchFilter={orderBranchFilter}
            isLoading={isLoading}
            onBranchFilterChange={setOrderBranchFilter}
            onUpdateStatus={updateOrderStatus}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAdmin
            adminKey={adminKey}
            isLoading={isLoading}
            onSaveSuccess={() => {
              setMessage('Configuraciones guardadas.');
              setTimeout(() => setMessage(''), 3000);
            }}
            onSaveError={(err) => {
              setError(err);
              setTimeout(() => setError(''), 5000);
            }}
          />
        )}

        {activeTab === 'feedback' && (
          <FeedbackAdmin
            feedbacks={feedbacks}
            isLoading={isLoading}
          />
        )}
      </section>


    </main>
  );
}

// --- SUB-COMPONENTE PRODUCTOS ---
interface ProductsAdminProps {
  categories: Category[];
  activeCategories: Category[];
  products: Product[];
  search: string;
  newProduct: typeof emptyProduct;
  isLoading: boolean;
  onSearch: (value: string) => void;
  onNewProductChange: (value: typeof emptyProduct) => void;
  onCreateProduct: () => void;
  onProductChange: (id: string, patch: Partial<Product>) => void;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
}

function ProductsAdmin({
  categories,
  activeCategories,
  products,
  search,
  newProduct,
  isLoading,
  onSearch,
  onNewProductChange,
  onCreateProduct,
  onProductChange,
  onSaveProduct,
  onDeleteProduct,
}: ProductsAdminProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[1.2fr_140px_1fr_2fr_auto]">
        <Input label="Nuevo producto" value={newProduct.name} onChange={(event) => onNewProductChange({ ...newProduct, name: event.target.value })} />
        <Input label="Precio" type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => onNewProductChange({ ...newProduct, price: Number(event.target.value) })} />
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Categoría
          <select
            value={newProduct.categoryId || categories[0]?.id || ''}
            onChange={(event) => onNewProductChange({ ...newProduct, categoryId: event.target.value })}
            className="h-14 rounded-lg border border-outline bg-background px-3 text-sm text-white outline-none focus:border-primary"
          >
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <Input label="Descripción" value={newProduct.description} onChange={(event) => onNewProductChange({ ...newProduct, description: event.target.value })} />
        <Button className="self-end animate-pulse-glow" onClick={onCreateProduct} disabled={isLoading || !newProduct.name || !newProduct.categoryId}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-outline bg-surface px-4 py-3">
        <Search size={18} className="text-gray-500" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar por producto, categoría o descripción..."
          className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3 text-left">Precio</th>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Descripción</th>
              <th className="p-3 text-left">Imagen (URL)</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-outline/50 hover:bg-surface-hover/30 transition-colors">
                <td className="p-2">
                  <input value={product.name} onChange={(event) => onProductChange(product.id, { name: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white" />
                </td>
                <td className="p-2">
                  <input type="number" min="0" step="0.01" value={product.price} onChange={(event) => onProductChange(product.id, { price: Number(event.target.value) })} className="h-10 w-24 rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white font-semibold" />
                </td>
                <td className="p-2">
                  <select value={product.categoryId} onChange={(event) => onProductChange(product.id, { categoryId: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white">
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input value={product.description ?? ''} onChange={(event) => onProductChange(product.id, { description: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white" />
                </td>
                <td className="p-2">
                  <input value={product.imageUrl ?? ''} onChange={(event) => onProductChange(product.id, { imageUrl: event.target.value })} className="h-10 w-full rounded-md border border-outline bg-background px-3 outline-none focus:border-primary text-white text-xs" />
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE CATEGORIAS ---
interface CategoriesAdminProps {
  categories: Category[];
  newCategory: { name: string; order: number };
  isLoading: boolean;
  onNewCategoryChange: (value: { name: string; order: number }) => void;
  onCreateCategory: () => void;
  onCategoryChange: (id: string, patch: Partial<Category>) => void;
  onSaveCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}

function CategoriesAdmin({
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
      <div className="grid gap-3 rounded-xl border border-outline bg-surface p-4 md:grid-cols-[1fr_140px_auto]">
        <Input label="Nueva categoría" value={newCategory.name} onChange={(event) => onNewCategoryChange({ ...newCategory, name: event.target.value })} />
        <Input label="Orden" type="number" min="0" value={newCategory.order} onChange={(event) => onNewCategoryChange({ ...newCategory, order: Number(event.target.value) })} />
        <Button className="self-end animate-pulse-glow" onClick={onCreateCategory} disabled={isLoading || !newCategory.name}>
          <Plus size={16} className="mr-2" /> Crear
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline bg-surface shadow-md">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Orden</th>
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

function PromotionsAdmin({ products, isLoading, onProductChange, onSaveProduct }: PromotionsAdminProps) {
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

function CustomersAdmin({
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

function OrdersAdmin({
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
  newBanner: { imageUrl: string; title: string; subtitle: string; buttonText: string; linkView: string; order: number };
  isLoading: boolean;
  onNewBannerChange: React.Dispatch<React.SetStateAction<{ imageUrl: string; title: string; subtitle: string; buttonText: string; linkView: string; order: number }>>;
  onCreateBanner: () => void;
  onBannerChange: (id: string, patch: Partial<HomeBanner>) => void;
  onSaveBanner: (banner: HomeBanner) => void;
  onDeleteBanner: (id: string) => void;
}

function BannersAdmin({
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

function SettingsAdmin({ adminKey, onSaveSuccess, onSaveError }: SettingsAdminProps) {
  const [facebookUrl, setFacebookUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
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
          label="Enlace de Reseñas en Google Maps"
          placeholder="https://search.google.com/local/writereview?placeid=..."
          value={googleReviewsUrl}
          onChange={(e) => setGoogleReviewsUrl(e.target.value)}
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

function FeedbackAdmin({ feedbacks, isLoading }: FeedbackAdminProps) {
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




