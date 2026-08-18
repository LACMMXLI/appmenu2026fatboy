export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? 'https://bakendmenu.fatboymexicali.com/api' : '/api')
).replace(/\/$/, '');
const NO_STORE: RequestCache = 'no-store';


export interface Branch {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  hours: string | null;
  mapsUrl: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  status: 'active' | 'inactive';
  imageUrl: string | null;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  status: 'active' | 'inactive';
  description: string | null;
  shortDescription: string | null;
  subcategory: string | null;
  imageUrl: string | null;
  isPromotion: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
  order: number;
  category: Category;
}

export interface RedeemableProduct {
  id: string;
  name: string;
  pointsCost: number;
  status: 'active' | 'inactive';
  imageUrl: string | null;
  description: string | null;
  order: number;
  createdAt: string;
}

export type PromotionStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'EXPIRED';

export interface Promotion {
  id: string;
  title: string;
  promoText: string;
  description: string;
  price: number;
  imageUrl: string;
  status: PromotionStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const defaultProductImage =
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop';

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/api/')) {
    const apiOrigin = API_BASE_URL.replace(/\/api$/, '');
    return `${apiOrigin}${url}`;
  }
  return url;
}

export async function getBranches(): Promise<Branch[]> {
  return getJson<Branch[]>('/branches');
}

export async function getCategories(): Promise<Category[]> {
  return getJson<Category[]>('/categories?status=active');
}

export async function getProducts(categoryId?: string): Promise<Product[]> {
  const query = categoryId ? `?status=active&categoryId=${encodeURIComponent(categoryId)}` : '?status=active';
  return getJson<Product[]>(`/products${query}`);
}

export async function getRedeemableProducts(): Promise<RedeemableProduct[]> {
  return getJson<RedeemableProduct[]>('/redeemable-products');
}

export async function getPromotions(): Promise<Promotion[]> {
  return getJson<Promotion[]>('/promotions');
}

export interface VisitStats {
  count: number;
  updatedAt: string | null;
}

export async function trackMenuVisit(): Promise<{ ok: boolean; count: number }> {
  return postJson<{ ok: boolean; count: number }>('/visits', {});
}

export interface AdminCatalog {
  categories: Category[];
  products: Product[];
}

export interface CategoryPayload {
  name?: string;
  order?: number;
  status?: 'active' | 'inactive';
  imageUrl?: string | null;
}

export interface ProductPayload {
  name?: string;
  price?: number;
  categoryId?: string;
  status?: 'active' | 'inactive';
  description?: string | null;
  shortDescription?: string | null;
  subcategory?: string | null;
  imageUrl?: string | null;
  isPromotion?: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
}

export async function getAdminCatalog(adminKey: string): Promise<AdminCatalog> {
  return adminJson<AdminCatalog>('/admin/catalog', adminKey);
}

export async function exportAdminCatalogWorkbook(adminKey: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/catalog/export`, {
    cache: NO_STORE,
    headers: { 'x-admin-key': adminKey },
  });
  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || 'No se pudo exportar el catálogo.');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'catalogo-fatboy.xlsx';
  return { blob: await response.blob(), fileName };
}

export async function importAdminCatalogWorkbook(adminKey: string, file: File): Promise<{ ok: boolean; updated: number }> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Selecciona un archivo .xlsx.');
  if (file.size > 8 * 1024 * 1024) throw new Error('El archivo supera el límite de 8 MB.');
  const fileData = await fileToBase64(file);
  return adminJson<{ ok: boolean; updated: number }>('/admin/catalog/import', adminKey, 'POST', {
    fileName: file.name,
    fileData,
  });
}

export async function getAdminVisitStats(adminKey: string): Promise<VisitStats> {
  return adminJson<VisitStats>('/admin/visits', adminKey);
}

export async function createAdminCategory(adminKey: string, payload: CategoryPayload): Promise<Category> {
  return adminJson<Category>('/admin/categories', adminKey, 'POST', payload);
}

export async function updateAdminCategory(adminKey: string, id: string, payload: CategoryPayload): Promise<Category> {
  return adminJson<Category>(`/admin/categories/${id}`, adminKey, 'PATCH', payload);
}

export async function deleteAdminCategory(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/categories/${id}`, adminKey, 'DELETE');
}

export async function createAdminProduct(adminKey: string, payload: ProductPayload): Promise<Product> {
  return adminJson<Product>('/admin/products', adminKey, 'POST', payload);
}

export async function updateAdminProduct(adminKey: string, id: string, payload: ProductPayload): Promise<Product> {
  return adminJson<Product>(`/admin/products/${id}`, adminKey, 'PATCH', payload);
}

export async function deleteAdminProduct(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/products/${id}`, adminKey, 'DELETE');
}

export interface RedeemableProductPayload {
  name?: string;
  pointsCost?: number;
  status?: 'active' | 'inactive';
  imageUrl?: string | null;
  description?: string | null;
  order?: number;
}

export async function getAdminRedeemableProducts(adminKey: string): Promise<RedeemableProduct[]> {
  return adminJson<RedeemableProduct[]>('/admin/redeemable-products', adminKey);
}

export interface RewardRedemption {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  remainingPoints: number;
  productName: string;
  pointsCost: number;
  createdAt: string;
}

export async function getAdminRewardRedemptions(adminKey: string): Promise<RewardRedemption[]> {
  return adminJson<RewardRedemption[]>('/admin/reward-redemptions', adminKey);
}

export async function createAdminRedeemableProduct(adminKey: string, payload: RedeemableProductPayload): Promise<RedeemableProduct> {
  return adminJson<RedeemableProduct>('/admin/redeemable-products', adminKey, 'POST', payload);
}

export async function updateAdminRedeemableProduct(adminKey: string, id: string, payload: RedeemableProductPayload): Promise<RedeemableProduct> {
  return adminJson<RedeemableProduct>(`/admin/redeemable-products/${id}`, adminKey, 'PATCH', payload);
}

export async function deleteAdminRedeemableProduct(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/redeemable-products/${id}`, adminKey, 'DELETE');
}

export interface PromotionPayload {
  title?: string;
  promoText?: string;
  description?: string;
  price?: number | string;
  imageUrl?: string | null;
}

export async function getAdminPromotions(adminKey: string): Promise<Promotion[]> {
  return adminJson<Promotion[]>('/admin/promotions', adminKey);
}

export async function createAdminPromotion(adminKey: string, payload: PromotionPayload): Promise<Promotion> {
  return adminJson<Promotion>('/admin/promotions', adminKey, 'POST', payload);
}

export async function updateAdminPromotion(adminKey: string, id: string, payload: PromotionPayload): Promise<Promotion> {
  return adminJson<Promotion>(`/admin/promotions/${id}`, adminKey, 'PATCH', payload);
}

export async function updateAdminPromotionStatus(adminKey: string, id: string, status: PromotionStatus): Promise<Promotion> {
  return adminJson<Promotion>(`/admin/promotions/${id}/status`, adminKey, 'PATCH', { status });
}

export async function uploadAdminPromotionImage(adminKey: string, file: File): Promise<{ imageUrl: string }> {
  const imageData = await readFileAsDataUrl(file);
  return adminJson<{ imageUrl: string }>('/admin/uploads/promotion-image', adminKey, 'POST', {
    fileName: file.name,
    imageData,
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: NO_STORE,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function adminJson<T>(path: string, adminKey: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: NO_STORE,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function readApiMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
    return typeof message === 'string' ? message : '';
  } catch {
    return '';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const comma = value.indexOf(',');
      if (comma < 0) reject(new Error('El archivo no es válido.'));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

// Auth API
export interface AuthResponse {
  token: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    points: number;
    favoriteBranchId: string | null;
    createdAt: string;
  };
}

export async function registerCustomer(payload: any): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth/register', payload);
}

export async function loginCustomer(payload: any): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth/login', payload);
}

export async function logoutCustomer(token: string): Promise<{ ok: boolean }> {
  return requestWithAuth<{ ok: boolean }>('/auth/logout', token, 'POST');
}

export async function getProfile(token: string): Promise<AuthResponse['customer']> {
  return requestWithAuth<AuthResponse['customer']>('/auth/profile', token);
}

export async function updateProfile(token: string, payload: any): Promise<AuthResponse['customer']> {
  return requestWithAuth<AuthResponse['customer']>('/auth/profile', token, 'PATCH', payload);
}

export async function changePassword(token: string, payload: any): Promise<{ ok: boolean }> {
  return requestWithAuth<{ ok: boolean }>('/auth/change-password', token, 'PATCH', payload);
}

export async function redeemRewardProduct(token: string, productId: string): Promise<{ redemption: { id: string; productName: string; pointsCost: number; createdAt: string }; customer: AuthResponse['customer'] }> {
  return requestWithAuth<{ redemption: { id: string; productName: string; pointsCost: number; createdAt: string }; customer: AuthResponse['customer'] }>(
    `/redeemable-products/${productId}/redeem`,
    token,
    'POST',
  );
}

// Order API
export interface OrderItemPayload {
  id: string;
  title: string;
  price: number;
  qty: number;
  isPromotion?: boolean;
  meatPrep?: string;
  extras?: { name: string; price: number }[];
  removals?: string[];
  notes?: string;
}

export interface OrderPayload {
  branchId: string;
  deliveryType: 'delivery' | 'pickup';
  paymentMethod: 'cash' | 'card';
  notes?: string;
  items: OrderItemPayload[];
}

export type OrderStatus =
  | 'PENDING_APPROVAL'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

// Never show the raw enum to a human (DIEZ) — always go through this.
export const ORDER_STATUS_LABELS_ES: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'Pendiente de aceptación',
  ACCEPTED: 'Aceptado',
  PREPARING: 'En preparación',
  READY: 'Listo para recoger',
  COMPLETED: 'Entregado',
  REJECTED: 'No aceptado',
  CANCELLED: 'Cancelado',
};

export interface Order {
  id: string;
  folio: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  branchId: string;
  branchName: string;
  status: OrderStatus;
  rejectionReason: string | null;
  cancellationRequestedAt: string | null;
  cancellationRequestReason: string | null;
  total: number;
  pointsEarned: number;
  pointsRedeemed: number;
  deliveryType: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    meatPrep: string | null;
    extras: string | null;
    removals: string | null;
  }[];
}

export interface PublicOrderTracking {
  id: string;
  folio: string;
  branchName: string;
  status: OrderStatus;
  rejectionReason: string | null;
  cancellationRequestedAt: string | null;
  cancellationRequestReason: string | null;
  total: number;
  deliveryType: string;
  paymentMethod: string;
  createdAt: string;
  items: {
    productName: string;
    quantity: number;
  }[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: string;
  staff: { id: string; name: string } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export async function createOrder(payload: OrderPayload, token: string): Promise<Order> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    cache: NO_STORE,
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<Order>;
}

// Orders require the requester's own session (customer or staff) — a
// pedido's id/folio alone is never authorization (DOCE). Unauthorized
// requests come back as 404 to avoid confirming an order exists.
export async function getOrder(id: string, token: string): Promise<PublicOrderTracking> {
  return requestWithAuth<PublicOrderTracking>(`/orders/${id}`, token);
}

export async function getOrderHistory(id: string, token: string): Promise<OrderStatusHistoryEntry[]> {
  return requestWithAuth<OrderStatusHistoryEntry[]>(`/orders/${id}/history`, token);
}

export async function getMyOrders(
  token: string,
  params: { limit?: number; cursor?: string } = {},
): Promise<PaginatedResult<PublicOrderTracking>> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestWithAuth<PaginatedResult<PublicOrderTracking>>(`/orders/mine${suffix}`, token);
}

// Staff auth API — replaces the shared ADMIN_CATALOG_KEY for order
// management. Each branch operator has their own account.
export interface Staff {
  id: string;
  name: string;
  username: string;
  role: 'STAFF' | 'MANAGER' | 'ADMIN';
  branchId: string | null;
  active: boolean;
  createdAt: string;
}

export interface StaffAuthResponse {
  token: string;
  staff: Staff;
}

export async function staffLogin(payload: { username: string; password: string }): Promise<StaffAuthResponse> {
  return postJson<StaffAuthResponse>('/staff/login', payload);
}

export async function staffLogout(token: string): Promise<{ ok: boolean }> {
  return requestWithAuth<{ ok: boolean }>('/staff/logout', token, 'POST');
}

export async function getStaffMe(token: string): Promise<Staff> {
  return requestWithAuth<Staff>('/staff/me', token);
}

// Admin Orders API — authorized with a Staff session token (Bearer), not the
// shared admin key. Non-ADMIN staff are branch-scoped by the backend itself.
export async function getAdminOrders(
  token: string,
  params: { branchId?: string; limit?: number; cursor?: string } = {},
): Promise<PaginatedResult<Order>> {
  const query = new URLSearchParams();
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestWithAuth<PaginatedResult<Order>>(`/admin/orders${suffix}`, token);
}

// Read-only order search for the catalog admin panel (VEINTISÉIS), gated by
// the master admin key it already uses for everything else there. Never
// exposes accept/reject/status — those stay Staff-session-only so every
// status change keeps a real, attributable owner.
export async function getAdminOrdersByKey(
  adminKey: string,
  params: { branchId?: string; limit?: number } = {},
): Promise<Order[]> {
  const query = new URLSearchParams();
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await adminJson<PaginatedResult<Order>>(`/admin/orders${suffix}`, adminKey);
  return result.items;
}

export async function acceptOrder(token: string, id: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/accept`, token, 'POST');
}

export async function rejectOrder(token: string, id: string, reason: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/reject`, token, 'POST', { reason });
}

export async function updateOrderStatus(
  token: string,
  id: string,
  status: Exclude<OrderStatus, 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED'>,
): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/status`, token, 'PATCH', { status });
}

// Customer-initiated cancellation. PENDING_APPROVAL cancels immediately;
// ACCEPTED/PREPARING only requests it — the branch approves or rejects.
export async function cancelOrder(token: string, id: string, reason?: string): Promise<PublicOrderTracking> {
  return requestWithAuth<PublicOrderTracking>(`/orders/${id}/cancel`, token, 'POST', { reason });
}

export async function approveCancellation(token: string, id: string, note?: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/cancellation/approve`, token, 'POST', { note });
}

export async function rejectCancellation(token: string, id: string, note?: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/cancellation/reject`, token, 'POST', { note });
}

// Admin Customers API
export interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
  favoriteBranchId: string | null;
  createdAt: string;
}

export async function getAdminCustomers(adminKey: string, query?: string): Promise<Customer[]> {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  return adminJson<Customer[]>(`/admin/customers${q}`, adminKey);
}

export async function updateAdminCustomerPoints(adminKey: string, id: string, points: number): Promise<Customer> {
  return adminJson<Customer>(`/admin/customers/${id}/points`, adminKey, 'PATCH', { points });
}

export async function updateAdminCustomer(adminKey: string, id: string, payload: any): Promise<Customer> {
  return adminJson<Customer>(`/admin/customers/${id}`, adminKey, 'PATCH', payload);
}

export async function deleteAdminCustomer(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/customers/${id}`, adminKey, 'DELETE');
}

// Helper fetchers
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    cache: NO_STORE,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function requestWithAuth<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: NO_STORE,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Home Banners API
export interface HomeBanner {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkView: string | null;
  order: number;
}

export async function getHomeBanners(): Promise<HomeBanner[]> {
  return getJson<HomeBanner[]>('/home-banners');
}

export async function createAdminHomeBanner(adminKey: string, payload: any): Promise<HomeBanner> {
  return adminJson<HomeBanner>('/admin/home-banners', adminKey, 'POST', payload);
}

export async function updateAdminHomeBanner(adminKey: string, id: string, payload: any): Promise<HomeBanner> {
  return adminJson<HomeBanner>(`/admin/home-banners/${id}`, adminKey, 'PATCH', payload);
}

export async function deleteAdminHomeBanner(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/home-banners/${id}`, adminKey, 'DELETE');
}

export async function getSystemSettings(): Promise<Record<string, string>> {
  return getJson<Record<string, string>>('/settings');
}

export async function updateAdminSystemSettings(adminKey: string, settings: Record<string, string>): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>('/admin/settings', adminKey, 'POST', { settings });
}

export interface FeedbackItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function submitFeedback(rating: number, comment: string): Promise<{ id: string }> {
  return postJson<{ id: string }>('/feedback', { rating, comment });
}

export async function getAdminFeedback(adminKey: string): Promise<FeedbackItem[]> {
  return adminJson<FeedbackItem[]>('/admin/feedback', adminKey);
}

export type SurveyWouldReturn = 'yes' | 'no' | 'maybe';

export interface SurveyPayload {
  branch: 'Venecia' | 'San Marcos' | 'Américas';
  ratingGeneral: number;
  ratingFood: number;
  ratingService: number;
  ratingWaitTime: number;
  ratingCleanliness: number;
  wouldReturn: SurveyWouldReturn;
  comment?: string;
}

export interface SurveyResponseItem extends SurveyPayload {
  id: string;
  comment: string | null;
  createdAt: string;
}

export interface SurveyAdminResult {
  metrics: {
    total: number;
    averageGeneral: number;
    averageFood: number;
    averageService: number;
    averageWaitTime: number;
    averageCleanliness: number;
    wouldReturnPercent: number;
  };
  recentComments: SurveyResponseItem[];
  responses: SurveyResponseItem[];
}

export interface SurveyFilters {
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
  ratingGeneral?: string;
  hasComment?: boolean;
}

export async function submitSurvey(payload: SurveyPayload): Promise<{ ok: boolean; id: string; createdAt: string }> {
  return postJson<{ ok: boolean; id: string; createdAt: string }>('/survey-responses', payload);
}

export async function getAdminSurveyResponses(adminKey: string, filters: SurveyFilters = {}): Promise<SurveyAdminResult> {
  const query = new URLSearchParams();
  if (filters.branch) query.set('branch', filters.branch);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);
  if (filters.ratingGeneral) query.set('ratingGeneral', filters.ratingGeneral);
  if (filters.hasComment) query.set('hasComment', 'true');
  const suffix = query.size ? `?${query.toString()}` : '';
  return adminJson<SurveyAdminResult>(`/admin/survey-responses${suffix}`, adminKey);
}
