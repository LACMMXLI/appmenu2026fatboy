const API_BASE_URL = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
const NO_STORE: RequestCache = 'no-store';


export interface Branch {
  id: string;
  name: string;
  phone: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  status: 'active' | 'inactive';
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
  imageUrl: string | null;
  isPromotion: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
  category: Category;
}

export const defaultProductImage =
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop';

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

export interface AdminCatalog {
  categories: Category[];
  products: Product[];
}

export interface CategoryPayload {
  name?: string;
  order?: number;
  status?: 'active' | 'inactive';
}

export interface ProductPayload {
  name?: string;
  price?: number;
  categoryId?: string;
  status?: 'active' | 'inactive';
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  isPromotion?: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
}

export async function getAdminCatalog(adminKey: string): Promise<AdminCatalog> {
  return adminJson<AdminCatalog>('/admin/catalog', adminKey);
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

export async function uploadAdminProductImage(adminKey: string, id: string, file: File, role = 'main'): Promise<Product> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('role', role);

  const response = await fetch(`${API_BASE_URL}/admin/products/${id}/image`, {
    method: 'POST',
    cache: NO_STORE,
    headers: {
      Accept: 'application/json',
      'x-admin-key': adminKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await readApiMessage(response);
    throw new Error(message || `API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<Product>;
}

export async function deleteAdminProduct(adminKey: string, id: string): Promise<{ ok: boolean }> {
  return adminJson<{ ok: boolean }>(`/admin/products/${id}`, adminKey, 'DELETE');
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

// Order API
export interface OrderItemPayload {
  id: string;
  title: string;
  price: number;
  qty: number;
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
  pointsToRedeem?: number;
  customerName?: string;
  customerPhone?: string;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  branchId: string;
  branchName: string;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
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

export async function createOrder(payload: OrderPayload, token?: string): Promise<Order> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
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

export async function getOrder(id: string): Promise<Order> {
  return getJson<Order>(`/orders/${id}`);
}

// Admin Orders API
export async function getAdminOrders(adminKey: string, branchId?: string): Promise<Order[]> {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return adminJson<Order[]>(`/admin/orders${query}`, adminKey);
}

export async function updateAdminOrderStatus(adminKey: string, id: string, status: string): Promise<Order> {
  return adminJson<Order>(`/admin/orders/${id}/status`, adminKey, 'PATCH', { status });
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
