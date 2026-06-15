import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  getAdminCustomers,
  updateAdminCustomerPoints,
  updateAdminCustomer,
  deleteAdminCustomer,
  getAdminOrders,
  updateAdminOrderStatus,
  getBranches,
  getHomeBanners,
  createAdminHomeBanner,
  updateAdminHomeBanner,
  deleteAdminHomeBanner,
  type HomeBanner,
  type Branch,
  type Customer,
  type Order,
  getAdminFeedback,
  type FeedbackItem,
  getAdminRedeemableProducts,
  createAdminRedeemableProduct,
  updateAdminRedeemableProduct,
  deleteAdminRedeemableProduct,
  type RedeemableProduct,
} from '@/lib/api';
import { AdminCatalogShell } from './admin-catalog/AdminCatalogShell';
import {
  BannersAdmin,
  CategoriesAdmin,
  CustomersAdmin,
  FeedbackAdmin,
  OrdersAdmin,
  ProductsAdmin,
  PromotionsAdmin,
  RedeemableProductsAdmin,
  SettingsAdmin,
} from './admin-catalog/AdminCatalogSections';
import type { NewBanner, NewCategory, NewProduct, NewRedeemableProduct, Tab } from './admin-catalog/adminCatalogTypes';

const emptyProduct = {
  name: '',
  price: 0,
  categoryId: '',
  description: '',
  imageUrl: '',
};

const emptyRedeemableProduct = {
  name: '',
  pointsCost: 100,
  imageUrl: '',
  description: '',
  order: 999,
};


export function AdminCatalogView() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('fatboy-admin-key') ?? '');
  const [catalog, setCatalog] = useState<AdminCatalog>({ categories: [], products: [] });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [redeemableProducts, setRedeemableProducts] = useState<RedeemableProduct[]>([]);

  
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderBranchFilter, setOrderBranchFilter] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [newCategory, setNewCategory] = useState<NewCategory>({ name: '', order: 999, imageUrl: '' });
  const [newProduct, setNewProduct] = useState<NewProduct>(emptyProduct);
  const [newRedeemableProduct, setNewRedeemableProduct] = useState<NewRedeemableProduct>(emptyRedeemableProduct);
  const [newBanner, setNewBanner] = useState<NewBanner>({ imageUrl: '', title: '', subtitle: '', buttonText: '', linkView: 'menu', order: 999 });

  const activeCategories = useMemo(
    () => catalog.categories.filter((category) => category.status === 'active'),
    [catalog.categories],
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.products.filter((product) => {
      if (productCategoryFilter && product.categoryId !== productCategoryFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(term) ||
        product.category.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.shortDescription?.toLowerCase().includes(term)
      );
    });
  }, [catalog.products, productCategoryFilter, search]);

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

      // Cargar productos canjeables
      const redeemablesList = await getAdminRedeemableProducts(key);
      setRedeemableProducts(redeemablesList);


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
        imageUrl: newProduct.imageUrl,
      });
      setNewProduct({ ...emptyProduct, categoryId: catalog.categories[0]?.id || '' });
      await refreshAll();
    }, 'Producto creado.');
  }

  // --- CANJEABLES ---
  function updateLocalRedeemableProduct(id: string, patch: Partial<RedeemableProduct>) {
    setRedeemableProducts((current) =>
      current.map((product) => (product.id === id ? { ...product, ...patch } : product)),
    );
  }

  async function createRedeemableProduct() {
    await runAction(async () => {
      await createAdminRedeemableProduct(adminKey, {
        ...newRedeemableProduct,
        pointsCost: Number(newRedeemableProduct.pointsCost),
        order: Number(newRedeemableProduct.order),
      });
      setNewRedeemableProduct(emptyRedeemableProduct);
      await refreshAll();
    }, 'Producto canjeable creado.');
  }

  async function saveRedeemableProduct(product: RedeemableProduct) {
    await runAction(async () => {
      await updateAdminRedeemableProduct(adminKey, product.id, {
        name: product.name,
        pointsCost: Number(product.pointsCost),
        status: product.status,
        imageUrl: product.imageUrl,
        description: product.description,
        order: Number(product.order),
      });
      await refreshAll();
    }, 'Producto canjeable guardado.');
  }

  async function deleteRedeemableProductAction(product: RedeemableProduct) {
    if (!window.confirm(`¿Eliminar producto canjeable "${product.name}"?`)) return;
    await runAction(async () => {
      await deleteAdminRedeemableProduct(adminKey, product.id);
      await refreshAll();
    }, 'Producto canjeable eliminado.');
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
        imageUrl: category.imageUrl,
      });
      await refreshAll();
    }, 'Categoría guardada.');
  }

  async function createCategory() {
    await runAction(async () => {
      await createAdminCategory(adminKey, newCategory);
      setNewCategory({ name: '', order: 999, imageUrl: '' });
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

  const tabCounts = useMemo(() => ({
    products: catalog.products.length,
    categories: catalog.categories.length,
    promotions: catalog.products.filter((product) => product.isPromotion).length,
    rewards: redeemableProducts.length,
    banners: banners.length,
    customers: customers.length,
    orders: orders.length,
    settings: 3,
    feedback: feedbacks.length,
  }), [catalog.products, catalog.categories, redeemableProducts.length, banners.length, customers.length, orders.length, feedbacks.length]);

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
    <AdminCatalogShell
      activeTab={activeTab}
      counts={tabCounts}
      message={message}
      error={error}
      isLoading={isLoading}
      onRefresh={() => refreshAll()}
      onTabChange={setActiveTab}
    >
      {activeTab === 'products' && (
        <ProductsAdmin
          categories={catalog.categories}
          activeCategories={activeCategories}
          products={visibleProducts}
          search={search}
          selectedCategoryId={productCategoryFilter}
          newProduct={newProduct}
          isLoading={isLoading}
          onSearch={setSearch}
          onCategoryFilterChange={setProductCategoryFilter}
          onNewProductChange={setNewProduct}
          onCreateProduct={createProduct}
          onProductChange={updateLocalProduct}
          onSaveProduct={saveProduct}
          onCancelChanges={() => refreshAll()}
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
            setBanners((prev) => prev.map((banner) => (banner.id === id ? { ...banner, ...patch } : banner)));
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

      {activeTab === 'rewards' && (
        <RedeemableProductsAdmin
          products={redeemableProducts}
          newProduct={newRedeemableProduct}
          isLoading={isLoading}
          onNewProductChange={setNewRedeemableProduct}
          onProductChange={updateLocalRedeemableProduct}
          onCreateProduct={createRedeemableProduct}
          onSaveProduct={saveRedeemableProduct}
          onDeleteProduct={deleteRedeemableProductAction}
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
            setCustomers((prev) => prev.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer)));
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

      {activeTab === 'feedback' && <FeedbackAdmin feedbacks={feedbacks} isLoading={isLoading} />}
    </AdminCatalogShell>
  );
}
