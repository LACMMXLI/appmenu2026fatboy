import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Search } from 'lucide-react';
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
  getAdminVisitStats,
  type VisitStats,
  getAdminPromotions,
  createAdminPromotion,
  updateAdminPromotion,
  updateAdminPromotionStatus,
  uploadAdminPromotionImage,
  type Promotion,
  getAdminSurveyResponses,
  type SurveyAdminResult,
  type SurveyFilters,
  exportAdminCatalogWorkbook,
  importAdminCatalogWorkbook,
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
  SurveysAdmin,
  VisitsAdmin,
} from './admin-catalog/AdminCatalogSections';
import type { NewBanner, NewCategory, NewProduct, NewPromotion, NewRedeemableProduct, Tab } from './admin-catalog/adminCatalogTypes';

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

const emptyPromotion: NewPromotion = {
  title: '',
  promoText: '',
  description: '',
  price: '',
  imageUrl: '',
};

const emptySurveyResult: SurveyAdminResult = {
  metrics: {
    total: 0,
    averageGeneral: 0,
    averageFood: 0,
    averageService: 0,
    averageWaitTime: 0,
    averageCleanliness: 0,
    wouldReturnPercent: 0,
  },
  recentComments: [],
  responses: [],
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
  const [visitStats, setVisitStats] = useState<VisitStats>({ count: 0, updatedAt: null });
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [surveyResult, setSurveyResult] = useState<SurveyAdminResult>(emptySurveyResult);
  const [surveyFilters, setSurveyFilters] = useState<SurveyFilters>({});
  const [isSurveyLoading, setIsSurveyLoading] = useState(false);

  
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
  const [newPromotion, setNewPromotion] = useState<NewPromotion>(emptyPromotion);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);

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

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4500);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 5500);
      return () => clearTimeout(t);
    }
  }, [error]);

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

      // Cargar promociones administrables
      const promotionsList = await getAdminPromotions(key);
      setPromotions(promotionsList);

      // Cargar visitas del menu
      const visits = await getAdminVisitStats(key);
      setVisitStats(visits);

      const surveys = await getAdminSurveyResponses(key);
      setSurveyResult(surveys);


      setIsAuthorized(true);
      sessionStorage.setItem('fatboy-admin-key', key);
    } catch (err) {
      setIsAuthorized(false);
      setError(err instanceof Error ? err.message : 'No se pudo abrir el panel.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSurveys(filters = surveyFilters) {
    try {
      setIsSurveyLoading(true);
      setError('');
      const surveys = await getAdminSurveyResponses(adminKey, filters);
      setSurveyResult(surveys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las encuestas.');
    } finally {
      setIsSurveyLoading(false);
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

  async function exportCatalogWorkbook() {
    try {
      setIsLoading(true);
      setError('');
      const { blob, fileName } = await exportAdminCatalogWorkbook(adminKey);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Catálogo exportado por categorías.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el catálogo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function importCatalogWorkbook(file: File) {
    await runAction(async () => {
      const result = await importAdminCatalogWorkbook(adminKey, file);
      await refreshAll();
      setMessage(`${result.updated} productos actualizados desde Excel.`);
    }, 'Catálogo actualizado desde Excel.');
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

  async function uploadPromotionImage(file: File) {
    try {
      setIsLoading(true);
      setError('');
      const uploaded = await uploadAdminPromotionImage(adminKey, file);
      setNewPromotion((current) => ({ ...current, imageUrl: uploaded.imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createPromotion() {
    await runAction(async () => {
      await createAdminPromotion(adminKey, {
        ...newPromotion,
        price: Number(newPromotion.price),
      });
      setNewPromotion(emptyPromotion);
      await refreshAll();
    }, 'Promoción publicada.');
  }

  async function savePromotion(promotion: Promotion) {
    await runAction(async () => {
      await updateAdminPromotion(adminKey, promotion.id, {
        title: promotion.title,
        promoText: promotion.promoText,
        description: promotion.description,
        price: Number(promotion.price),
        imageUrl: promotion.imageUrl,
      });
      await refreshAll();
    }, 'Promoción guardada.');
  }

  async function changePromotionStatus(promotion: Promotion, status: Promotion['status']) {
    await runAction(async () => {
      await updateAdminPromotionStatus(adminKey, promotion.id, status);
      await refreshAll();
    }, status === 'PAUSED' ? 'Promoción pausada.' : 'Estado de promoción actualizado.');
  }

  function updateLocalPromotion(id: string, patch: Partial<Promotion>) {
    setPromotions((current) => current.map((promotion) => (promotion.id === id ? { ...promotion, ...patch } : promotion)));
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
    promotions: promotions.length,
    rewards: redeemableProducts.length,
    banners: banners.length,
    customers: customers.length,
    orders: orders.length,
    visits: visitStats.count,
    settings: 3,
    feedback: feedbacks.length,
    surveys: surveyResult.metrics.total,
  }), [catalog.products, catalog.categories, promotions.length, redeemableProducts.length, banners.length, customers.length, orders.length, visitStats.count, feedbacks.length, surveyResult.metrics.total]);

  const headerControls = useMemo(() => {
    if (activeTab === 'products') {
      return (
        <div className="flex items-center gap-1.5 flex-1 md:flex-initial justify-end">
          <div className="flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-2 py-1 transition-all focus-within:border-primary/50 flex-1 max-w-[140px] sm:max-w-[180px] md:max-w-[200px]">
            <Search size={13} className="shrink-0 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto..."
              className="h-7 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
            />
          </div>
          
          <select
            value={productCategoryFilter}
            onChange={(event) => setProductCategoryFilter(event.target.value)}
            className="h-9 rounded-lg border border-outline bg-surface px-2 text-xs text-white outline-none focus:border-primary transition-colors max-w-[110px] sm:max-w-[140px] truncate"
          >
            <option value="">Categorías</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          
          <Button
            onClick={() => setIsCreateProductOpen(true)}
            disabled={isLoading || activeCategories.length === 0}
            size="sm"
            className="h-9 shrink-0 px-2 md:px-3 text-xs flex items-center justify-center"
            title="Nuevo producto"
          >
            <Plus size={14} />
            <span className="hidden sm:inline ml-1">Nuevo</span>
          </Button>
        </div>
      );
    }

    if (activeTab === 'customers') {
      return (
        <div className="flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-2 py-1 transition-all focus-within:border-primary/50 flex-grow max-w-[180px] sm:max-w-[220px]">
          <Search size={13} className="shrink-0 text-gray-500" />
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="h-7 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
            onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
          />
        </div>
      );
    }

    if (activeTab === 'orders') {
      return (
        <select
          value={orderBranchFilter}
          onChange={(e) => setOrderBranchFilter(e.target.value)}
          className="h-9 rounded-lg border border-outline bg-surface px-2 text-xs text-white outline-none focus:border-primary transition-colors max-w-[130px] sm:max-w-[160px] truncate"
        >
          <option value="">Sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      );
    }

    return null;
  }, [activeTab, search, productCategoryFilter, customerSearch, orderBranchFilter, catalog.categories, branches, isLoading, activeCategories.length]);

  if (!isAuthorized) {
    return (
      <main className="admin-aurora min-h-[100dvh] text-white flex items-center justify-center px-5 relative overflow-hidden">
        {/* Decorative radial glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/3 h-64 w-64 rounded-full bg-primary/8 blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 h-48 w-48 rounded-full bg-gold/5 blur-[80px]" />
        </div>

        <form onSubmit={handleUnlock} className="admin-gradient-border relative w-full max-w-sm rounded-2xl p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          {/* Glass inner surface */}
          <div className="absolute inset-[1px] rounded-2xl bg-surface/95 backdrop-blur-xl" style={{ zIndex: -1 }} />

          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shadow-[0_0_20px_rgba(232,0,10,0.3)]">
              <KeyRound size={22} />
            </div>
            <div>
              <h1 className="admin-shimmer font-display text-3xl leading-none">ADMINISTRACIÓN</h1>
              <p className="text-xs text-gray-400 mt-0.5">Control total del restaurante Fatboy.</p>
            </div>
          </div>

          <Input
            label="Clave administrativa"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            autoFocus
          />

          {error && (
            <p className="mt-3 text-sm text-primary flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="mt-5 w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary shadow-[0_0_20px_rgba(232,0,10,0.25)] transition-all duration-300"
            isLoading={isLoading}
          >
            Entrar
          </Button>

          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Fatboy POS · Panel Administrativo
          </p>
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
      headerControls={headerControls}
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
          isCreateOpen={isCreateProductOpen}
          setIsCreateOpen={setIsCreateProductOpen}
          onExportCatalog={exportCatalogWorkbook}
          onImportCatalog={importCatalogWorkbook}
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
          onCancelChanges={() => refreshAll()}
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
          promotions={promotions}
          newPromotion={newPromotion}
          isLoading={isLoading}
          onNewPromotionChange={setNewPromotion}
          onUploadImage={uploadPromotionImage}
          onCreatePromotion={createPromotion}
          onPromotionChange={updateLocalPromotion}
          onSavePromotion={savePromotion}
          onStatusChange={changePromotionStatus}
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

      {activeTab === 'visits' && <VisitsAdmin stats={visitStats} isLoading={isLoading} />}

      {activeTab === 'surveys' && (
        <SurveysAdmin
          result={surveyResult}
          filters={surveyFilters}
          isLoading={isSurveyLoading}
          onFiltersChange={setSurveyFilters}
          onApplyFilters={loadSurveys}
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
