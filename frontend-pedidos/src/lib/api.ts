import type { PrintDocumentType } from '../desktop/desktop-types';

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

export async function changeStaffPassword(
  token: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<{ ok: boolean }> {
  return requestWithAuth<{ ok: boolean }>('/staff/change-password', token, 'POST', payload);
}

export async function listStaff(token: string): Promise<Staff[]> {
  return requestWithAuth<Staff[]>('/admin/staff', token);
}

export async function createStaff(
  token: string,
  payload: { name: string; username: string; password: string; role: Staff['role']; branchId: string | null },
): Promise<Staff> {
  return requestWithAuth<Staff>('/admin/staff', token, 'POST', payload);
}

export async function updateStaff(
  token: string,
  id: string,
  payload: Partial<Pick<Staff, 'name' | 'role' | 'branchId' | 'active'>>,
): Promise<Staff> {
  return requestWithAuth<Staff>(`/admin/staff/${id}`, token, 'PATCH', payload);
}

export async function resetStaffPassword(token: string, id: string, password: string): Promise<Staff> {
  return requestWithAuth<Staff>(`/admin/staff/${id}/password`, token, 'POST', { password });
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

export type PrintJobStatus = 'PENDING' | 'CLAIMED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'UNCERTAIN';

export interface PrintJob {
  id: string;
  orderId: string;
  branchId: string;
  documentType: PrintDocumentType;
  status: PrintJobStatus;
  attempts: number;
  claimedByStationId: string | null;
  claimedByStationName: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  nextAttemptAt: string | null;
  printingStartedAt: string | null;
  printedAt: string | null;
  uncertainAt: string | null;
  lastError: string | null;
  lastResult: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { folio: string; branchName: string };
}

export interface ClaimedPrintJobResponse {
  job: PrintJob | null;
  order: Order | null;
}

// Tablero operativo — autoscopeado a la sucursal del operador por el
// backend (Sección Seis/Veinticuatro): un STAFF/MANAGER nunca puede pedir
// pedidos de otra sucursal aunque mande otro branchId.
//
// `query` (folio/cliente/teléfono) y `statuses` filtran server-side — el
// historial nunca descarga miles de pedidos al frontend para buscar
// localmente (Sección Veintiuno).
export async function getAdminOrders(
  token: string,
  params: { branchId?: string; limit?: number; cursor?: string; query?: string; statuses?: OrderStatus[] } = {},
): Promise<PaginatedResult<Order>> {
  const search = new URLSearchParams();
  if (params.branchId) search.set('branchId', params.branchId);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.query) search.set('q', params.query);
  if (params.statuses?.length) search.set('status', params.statuses.join(','));
  const suffix = search.size ? `?${search.toString()}` : '';
  return requestWithAuth<PaginatedResult<Order>>(`/admin/orders${suffix}`, token);
}

export const DELETE_ALL_ORDERS_CONFIRMATION = 'ELIMINAR TODOS LOS PEDIDOS';

export interface DeleteAllOrdersResult {
  deletedOrders: number;
  deletedOrderItems: number;
  deletedStatusHistory: number;
  deletedPrintJobs: number;
  preservedCustomers: number;
}

export async function deleteAllOrders(token: string): Promise<DeleteAllOrdersResult> {
  return requestWithAuth<DeleteAllOrdersResult>('/admin/orders', token, 'DELETE', {
    confirmation: DELETE_ALL_ORDERS_CONFIRMATION,
  });
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

// ── Cola durable de impresión ────────────────────────────────────────────

export async function claimNextPrintJob(
  token: string,
  payload: { branchId: string; stationId: string; stationName: string },
): Promise<ClaimedPrintJobResponse> {
  return requestWithAuth<ClaimedPrintJobResponse>('/printing/jobs/claim', token, 'POST', payload);
}

export async function startPrintJob(
  token: string,
  id: string,
  payload: { branchId: string; stationId: string },
): Promise<PrintJob> {
  return requestWithAuth<PrintJob>(`/printing/jobs/${id}/start`, token, 'POST', payload);
}

export async function completePrintJob(
  token: string,
  id: string,
  payload: { branchId: string; stationId: string; result: string },
): Promise<PrintJob> {
  return requestWithAuth<PrintJob>(`/printing/jobs/${id}/complete`, token, 'POST', payload);
}

export async function failPrintJob(
  token: string,
  id: string,
  payload: { branchId: string; stationId: string; error: string },
): Promise<PrintJob> {
  return requestWithAuth<PrintJob>(`/printing/jobs/${id}/fail`, token, 'POST', payload);
}

export async function retryPrintJob(token: string, id: string, branchId: string): Promise<PrintJob> {
  return requestWithAuth<PrintJob>(`/printing/jobs/${id}/retry`, token, 'POST', { branchId });
}

export async function listPrintJobs(token: string, branchId: string, limit = 20): Promise<PrintJob[]> {
  const search = new URLSearchParams({ branchId, limit: String(limit) });
  return requestWithAuth<PrintJob[]>(`/printing/jobs?${search.toString()}`, token);
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
