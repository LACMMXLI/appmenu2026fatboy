// Cliente HTTP del backend NestJS existente — mismo backend que `frontend/`
// (Sección Cinco del plan: reutilizar todo lo construido, no duplicar
// lógica de negocio en React). Este archivo contiene deliberadamente solo
// lo que Fatboy Pedidos necesita: sucursales, sesión de personal y pedidos.
// Todo lo de catálogo/clientes/promos/reseñas vive únicamente en
// `frontend/src/lib/api.ts` — no pertenece a esta app.

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

export async function getBranches(): Promise<Branch[]> {
  return getJson<Branch[]>('/branches');
}

// ── Staff (StaffSession) ─────────────────────────────────────────────────
// Sección Seis del plan: Fatboy Pedidos se autentica exclusivamente con
// StaffSession. Nunca ADMIN_CATALOG_KEY, nunca la sesión de clientes.

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

// ── Orders ────────────────────────────────────────────────────────────────
// Espejo exacto de la máquina de estados del backend (Sección Ocho). No
// agregar estados aquí — el backend es la única autoridad (Treinta y ocho).

export type OrderStatus =
  | 'PENDING_APPROVAL'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

// Nunca mostrar el enum crudo al operador (Diez) — siempre pasar por esto.
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

// Tablero operativo — autoscopeado a la sucursal del operador por el
// backend (Sección Seis/Veinticuatro): un STAFF/MANAGER nunca puede pedir
// pedidos de otra sucursal aunque mande otro branchId.
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

export async function getOrder(id: string, token: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}`, token);
}

export async function getOrderHistory(id: string, token: string): Promise<OrderStatusHistoryEntry[]> {
  return requestWithAuth<OrderStatusHistoryEntry[]>(`/orders/${id}/history`, token);
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

export async function approveCancellation(token: string, id: string, note?: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/cancellation/approve`, token, 'POST', { note });
}

export async function rejectCancellation(token: string, id: string, note?: string): Promise<Order> {
  return requestWithAuth<Order>(`/orders/${id}/cancellation/reject`, token, 'POST', { note });
}

// ── Helpers HTTP internos ────────────────────────────────────────────────

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: NO_STORE,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

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

async function readApiMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
    return typeof message === 'string' ? message : '';
  } catch {
    return '';
  }
}
