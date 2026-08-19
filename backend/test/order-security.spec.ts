import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { bootstrapTestApp, uniqueSuffix, json } from './helpers/app.js';

let baseUrl: string;
let app: Awaited<ReturnType<typeof bootstrapTestApp>>['app'];

let branchAId: string;
let branchBId: string;
let productId: string;
let productPrice: number;

// Registered/created once in `before` and reused across tests — /auth/register
// and /auth/login are rate-limited (AuthRateLimitGuard, a real production
// protection we should not weaken just to make tests convenient). Only
// orders/status changes (unthrottled) are created fresh per test.
let owner: { token: string; customer: { id: string } };
let intruder: { token: string; customer: { id: string } };
let staffA: { token: string; staff: { id: string } }; // assigned to branchA
let staffB: { token: string; staff: { id: string } }; // assigned to branchB

async function registerCustomer(suffix: string) {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Test ${suffix}`, phone: `6110000${suffix}`.slice(-10), password: 'password123' }),
  });
  const body = await json(res);
  assert.equal(res.status, 201, JSON.stringify(body));
  return body as { token: string; customer: { id: string } };
}

async function createStaff(suffix: string, branchId: string | null, role: 'STAFF' | 'ADMIN' = 'STAFF') {
  const res = await fetch(`${baseUrl}/admin/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_CATALOG_KEY! },
    body: JSON.stringify({ name: `Staff ${suffix}`, username: `staff_${suffix}`, password: 'password123', role, branchId }),
  });
  const body = await json(res);
  assert.equal(res.status, 201, JSON.stringify(body));

  const login = await fetch(`${baseUrl}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `staff_${suffix}`, password: 'password123' }),
  });
  const loginBody = await json(login);
  assert.equal(login.status, 201, JSON.stringify(loginBody));
  return loginBody as { token: string; staff: { id: string } };
}

async function createOrder(token: string, branchId: string) {
  return fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      branchId,
      deliveryType: 'pickup',
      paymentMethod: 'cash',
      items: [{ id: productId, title: 'x', price: 1, qty: 1 }],
    }),
  });
}

// pointsEarned = floor(total / 10) — enough quantity of the real seeded
// product to guarantee at least 1 point is at stake, split across multiple
// line items since a single item is capped at MAX_ITEM_QTY (20).
async function createOrderThatEarnsPoints(token: string, branchId: string) {
  const totalQtyNeeded = Math.max(1, Math.ceil(10 / productPrice));
  const items: { id: string; title: string; price: number; qty: number }[] = [];
  let remaining = totalQtyNeeded;
  while (remaining > 0) {
    const qty = Math.min(20, remaining);
    items.push({ id: productId, title: 'x', price: 1, qty });
    remaining -= qty;
  }
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ branchId, deliveryType: 'pickup', paymentMethod: 'cash', items }),
  });
  const order = await json(res);
  assert.equal(res.status, 201, JSON.stringify(order));
  assert.ok(order.pointsEarned > 0, 'test product price too low to exercise points logic — adjust seed data');
  return order;
}

async function getPoints(token: string): Promise<number> {
  const res = await fetch(`${baseUrl}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await json(res);
  assert.equal(res.status, 200, JSON.stringify(body));
  return body.points;
}

before(async () => {
  if (!process.env.ADMIN_CATALOG_KEY) {
    throw new Error('ADMIN_CATALOG_KEY must be set in backend/.env to run these tests.');
  }

  const booted = await bootstrapTestApp();
  app = booted.app;
  baseUrl = booted.baseUrl;

  const branches = await json(await fetch(`${baseUrl}/branches`));
  assert.ok(Array.isArray(branches) && branches.length >= 2, 'Need at least 2 seeded branches to test branch scoping.');
  branchAId = branches[0].id;
  branchBId = branches[1].id;

  const products = await json(await fetch(`${baseUrl}/products?status=active`));
  assert.ok(Array.isArray(products) && products.length >= 1, 'Need at least 1 active product.');
  productId = products[0].id;
  productPrice = Number(products[0].price);

  // Distinct suffixes per identity — registerCustomer derives the phone
  // number from the last 10 digits of the suffix, so reusing one suffix
  // across identities (even with a different letter prefix) collides once
  // the prefix gets sliced away.
  owner = await registerCustomer(uniqueSuffix());
  intruder = await registerCustomer(uniqueSuffix());
  const staffSuffix = uniqueSuffix();
  staffA = await createStaff(`a${staffSuffix}`, branchAId);
  staffB = await createStaff(`b${staffSuffix}`, branchBId);
});

after(async () => {
  await app.close();
});

// --- TREINTA Y SIETE: pruebas de seguridad ---

test('unauthenticated order creation is rejected', async () => {
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId: branchAId, deliveryType: 'pickup', paymentMethod: 'cash', items: [{ id: productId, qty: 1 }] }),
  });
  assert.equal(res.status, 401);
});

test('authenticated order creation is permitted and gets a folio + PENDING_APPROVAL', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  assert.match(order.folio, /^FB-\d{6}$/);
  assert.equal(order.status, 'PENDING_APPROVAL');
  assert.equal(order.customerId, owner.customer.id);
});

test('a customer cannot read another customer\'s order (IDOR) — gets 404, not 403', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const asOwner = await fetch(`${baseUrl}/orders/${order.id}`, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(asOwner.status, 200);

  const asIntruder = await fetch(`${baseUrl}/orders/${order.id}`, { headers: { Authorization: `Bearer ${intruder.token}` } });
  assert.equal(asIntruder.status, 404);
});

test('a customer cannot obtain another customer\'s order by modifying only the id in the URL', async () => {
  const orderOwner = await json(await createOrder(owner.token, branchAId));
  const orderIntruder = await json(await createOrder(intruder.token, branchAId));
  assert.notEqual(orderOwner.id, orderIntruder.id);

  const res = await fetch(`${baseUrl}/orders/${orderIntruder.id}`, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(res.status, 404);
});

test('client-supplied price is ignored — server recalculates from the DB product price', async () => {
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({
      branchId: branchAId,
      deliveryType: 'pickup',
      paymentMethod: 'cash',
      items: [{ id: productId, title: 'x', price: 0.01, qty: 1 }], // attempted price tampering
    }),
  });
  const order = await json(res);
  assert.equal(res.status, 201);
  assert.notEqual(order.total, 0.01);
  assert.equal(order.total, order.items[0].price * order.items[0].quantity);
});

test('staff without a session cannot manage orders', async () => {
  const res = await fetch(`${baseUrl}/admin/orders`);
  assert.equal(res.status, 401);
});

test('staff assigned to another branch cannot act on this order (403), and cannot list it (403)', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const getOrder = await fetch(`${baseUrl}/orders/${order.id}`, { headers: { Authorization: `Bearer ${staffB.token}` } });
  assert.equal(getOrder.status, 404); // not staff's branch — same "don't confirm it exists" rule

  const accept = await fetch(`${baseUrl}/orders/${order.id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffB.token}` },
  });
  assert.equal(accept.status, 403);

  const list = await fetch(`${baseUrl}/admin/orders?branchId=${branchAId}`, {
    headers: { Authorization: `Bearer ${staffB.token}` },
  });
  assert.equal(list.status, 403);
});

test('an expired/garbage token is rejected, not treated as anonymous', async () => {
  const res = await fetch(`${baseUrl}/orders/mine`, { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.equal(res.status, 401);
});

// --- TREINTA Y OCHO: pruebas funcionales (máquina de estados / folio / motivo) ---

test('full lifecycle: accept -> preparing -> ready -> completed, each step recorded in history', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const accept = await fetch(`${baseUrl}/orders/${order.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${staffA.token}` } });
  assert.equal(accept.status, 201);
  assert.equal((await json(accept)).status, 'ACCEPTED');

  const preparing = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  assert.equal((await json(preparing)).status, 'PREPARING');

  const ready = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'READY' }),
  });
  assert.equal((await json(ready)).status, 'READY');

  const completed = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert.equal((await json(completed)).status, 'COMPLETED');

  const history = await json(await fetch(`${baseUrl}/orders/${order.id}/history`, { headers: { Authorization: `Bearer ${owner.token}` } }));
  const toStatuses = history.map((h: any) => h.toStatus);
  assert.deepEqual(toStatuses, ['PENDING_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED']);
  assert.equal(history[1].staff.id, staffA.staff.id); // acceptance is attributed to the real staff account
});

test('rejecting without a reason is rejected by the API', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('rejecting with a reason moves to REJECTED and the customer can see the reason', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ reason: 'Producto agotado' }),
  });
  const rejected = await json(res);
  assert.equal(res.status, 201);
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.rejectionReason, 'Producto agotado');
});

test('invalid transitions are rejected: PENDING_APPROVAL cannot jump straight to READY', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'READY' }),
  });
  assert.equal(res.status, 400);
});

test('the generic /status endpoint refuses ACCEPTED/REJECTED — must go through /accept or /reject', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  assert.equal(res.status, 400);
});

// --- TREINTA Y NUEVE: pruebas de concurrencia ---

test('several simultaneous orders never share a folio', async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => createOrder(owner.token, branchAId)));
  const orders = await Promise.all(results.map((r) => json(r)));
  orders.forEach((o) => assert.equal(o.folio && /^FB-\d{6}$/.test(o.folio), true));

  const folios = new Set(orders.map((o) => o.folio));
  assert.equal(folios.size, orders.length, 'Folios collided under concurrent creation');
});

test('accept vs reject race: only one operation wins, the other is rejected (409 or stale-state 400)', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const [acceptRes, rejectRes] = await Promise.all([
    fetch(`${baseUrl}/orders/${order.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${staffA.token}` } }),
    fetch(`${baseUrl}/orders/${order.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
      body: JSON.stringify({ reason: 'race' }),
    }),
  ]);

  const statuses = [acceptRes.status, rejectRes.status].sort((a, b) => a - b);
  // Exactly one succeeded (201); the other lost the race, either caught by
  // the optimistic lock (409) or by re-validating against the now-stale
  // state (400) — both mean "the DB, not the client, decided the winner".
  // 201 always sorts first since 201 < 400 <= 409.
  assert.equal(statuses[0], 201, `Expected exactly one 201, got ${statuses}`);
  assert.ok([400, 409].includes(statuses[1]), `Loser should be 400 or 409, got ${statuses}`);

  const final = await json(await fetch(`${baseUrl}/orders/${order.id}`, { headers: { Authorization: `Bearer ${owner.token}` } }));
  assert.ok(['ACCEPTED', 'REJECTED'].includes(final.status));

  const history = await json(await fetch(`${baseUrl}/orders/${order.id}/history`, { headers: { Authorization: `Bearer ${owner.token}` } }));
  // Exactly one transition away from PENDING_APPROVAL was recorded, never both.
  assert.equal(history.length, 2);
});

// --- Customer-initiated cancellation ---

async function acceptOrder(orderId: string) {
  const res = await fetch(`${baseUrl}/orders/${orderId}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${staffA.token}` } });
  assert.equal(res.status, 201);
  return json(res);
}

test('customer cancels a PENDING_APPROVAL order directly — no branch approval needed', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({}),
  });
  const cancelled = await json(res);
  assert.equal(res.status, 201);
  assert.equal(cancelled.status, 'CANCELLED');
});

test('a customer cannot cancel another customer\'s order', async () => {
  const order = await json(await createOrder(owner.token, branchAId));

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intruder.token}` },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 404);
});

test('customer requests cancellation of an ACCEPTED order — status stays ACCEPTED until the branch decides', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ reason: 'Ya no lo quiero' }),
  });
  const requested = await json(res);
  assert.equal(res.status, 201);
  assert.equal(requested.status, 'ACCEPTED'); // unchanged — pending branch decision
  assert.ok(requested.cancellationRequestedAt);
  assert.equal(requested.cancellationRequestReason, 'Ya no lo quiero');
});

test('requesting cancellation twice on the same order is rejected (409)', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);

  const first = await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(first.status, 201);

  const second = await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(second.status, 409);
});

test('branch approves a cancellation request — order becomes CANCELLED, staff attributed', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancellation/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({}),
  });
  const resolved = await json(res);
  assert.equal(res.status, 201);
  assert.equal(resolved.status, 'CANCELLED');
  assert.equal(resolved.cancellationRequestedAt, null);

  const history = await json(await fetch(`${baseUrl}/orders/${order.id}/history`, { headers: { Authorization: `Bearer ${owner.token}` } }));
  assert.equal(history[history.length - 1].toStatus, 'CANCELLED');
  assert.equal(history[history.length - 1].staff.id, staffA.staff.id);
});

test('branch rejects a cancellation request — order keeps going, request flag cleared', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancellation/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ note: 'Ya está en preparación' }),
  });
  const resolved = await json(res);
  assert.equal(res.status, 201);
  assert.equal(resolved.status, 'ACCEPTED'); // still going
  assert.equal(resolved.cancellationRequestedAt, null);

  // The order can still be advanced normally afterwards.
  const preparing = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  assert.equal(preparing.status, 200); // PATCH defaults to 200, unlike POST's 201
});

test('staff of another branch cannot resolve a cancellation request', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancellation/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffB.token}` },
  });
  assert.equal(res.status, 403);
});

test('resolving a cancellation request that was never made is rejected', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancellation/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffA.token}` },
  });
  assert.equal(res.status, 400);
});

test('a READY order can no longer be cancelled by the customer', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'READY' }),
  });

  const res = await fetch(`${baseUrl}/orders/${order.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(res.status, 400);
});

// --- Points are only credited on delivery (COMPLETED), never before, and
// never twice for the same order. ---

test('creating an order does not credit points yet', async () => {
  const before = await getPoints(owner.token);
  await createOrderThatEarnsPoints(owner.token, branchAId);
  const after = await getPoints(owner.token);
  assert.equal(after, before, 'points must not change until the order is delivered');
});

test('accepting/preparing/marking ready does not credit points either', async () => {
  const before = await getPoints(owner.token);
  const order = await createOrderThatEarnsPoints(owner.token, branchAId);
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'READY' }),
  });
  const after = await getPoints(owner.token);
  assert.equal(after, before, 'points must not change before COMPLETED, no matter how far along the order is');
});

test('marking an order COMPLETED credits exactly pointsEarned, once', async () => {
  const before = await getPoints(owner.token);
  const order = await createOrderThatEarnsPoints(owner.token, branchAId);
  await acceptOrder(order.id);
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'READY' }),
  });
  const completed = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert.equal(completed.status, 200);

  const afterFirstCompletion = await getPoints(owner.token);
  assert.equal(afterFirstCompletion, before + order.pointsEarned);

  // COMPLETED is terminal — the state machine itself forbids re-entering it,
  // so a second "complete" attempt must be rejected outright, and points
  // must not move again.
  const secondAttempt = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert.equal(secondAttempt.status, 400);
  const afterSecondAttempt = await getPoints(owner.token);
  assert.equal(afterSecondAttempt, afterFirstCompletion, 'points must never be credited twice for the same order');
});

test('cancelling an order before delivery never generates points', async () => {
  const before = await getPoints(owner.token);
  const order = await createOrderThatEarnsPoints(owner.token, branchAId);

  // Cancel immediately, before the branch even accepts it.
  const cancel = await fetch(`${baseUrl}/orders/${order.id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  assert.equal(cancel.status, 201);
  assert.equal((await json(cancel)).status, 'CANCELLED');

  const after = await getPoints(owner.token);
  assert.equal(after, before, 'a cancelled order must never leave the customer with points');
});

test('a rejected order never generates points', async () => {
  const before = await getPoints(owner.token);
  const order = await createOrderThatEarnsPoints(owner.token, branchAId);

  const reject = await fetch(`${baseUrl}/orders/${order.id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ reason: 'Sin existencias' }),
  });
  assert.equal(reject.status, 201);

  const after = await getPoints(owner.token);
  assert.equal(after, before, 'a rejected order must never generate points');
});

// --- Fase 3: cola durable de impresión por sucursal/estación ---

async function acceptWithProductionPrintJob(orderId: string) {
  const res = await fetch(`${baseUrl}/orders/${orderId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ createProductionPrintJob: true }),
  });
  const body = await json(res);
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.equal(body.status, 'ACCEPTED');
  return body;
}

async function claimPrintJob(token: string, branchId: string, stationId: string, stationName: string) {
  const res = await fetch(`${baseUrl}/printing/jobs/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ branchId, stationId, stationName }),
  });
  return { res, body: await json(res) };
}

test('automatic acceptance creates one branch-scoped job and only one station can claim it', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptWithProductionPrintJob(order.id);
  const stationA = randomUUID();
  const stationB = randomUUID();

  const wrongBranch = await claimPrintJob(staffB.token, branchAId, stationB, 'OTRA-SUCURSAL');
  assert.equal(wrongBranch.res.status, 403);

  const first = await claimPrintJob(staffA.token, branchAId, stationA, 'RECEPCION-A');
  assert.equal(first.res.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.job.orderId, order.id);
  assert.equal(first.body.job.status, 'CLAIMED');
  assert.equal(first.body.job.attempts, 1);
  assert.equal(first.body.order.id, order.id);

  const second = await claimPrintJob(staffA.token, branchAId, stationB, 'RECEPCION-B');
  assert.equal(second.res.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.job, null);
  assert.equal(second.body.order, null);

  const wrongStationStart = await fetch(`${baseUrl}/printing/jobs/${first.body.job.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ branchId: branchAId, stationId: stationB }),
  });
  assert.equal(wrongStationStart.status, 409);

  const start = await fetch(`${baseUrl}/printing/jobs/${first.body.job.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ branchId: branchAId, stationId: stationA }),
  });
  assert.equal(start.status, 201);
  assert.equal((await json(start)).status, 'PRINTING');

  const complete = await fetch(`${baseUrl}/printing/jobs/${first.body.job.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ branchId: branchAId, stationId: stationA, result: 'Windows aceptó el trabajo.' }),
  });
  assert.equal(complete.status, 201);
  assert.equal((await json(complete)).status, 'PRINTED');

  const recent = await fetch(`${baseUrl}/printing/jobs?branchId=${branchAId}&limit=10`, {
    headers: { Authorization: `Bearer ${staffA.token}` },
  });
  const jobs = await json(recent);
  assert.equal(recent.status, 200, JSON.stringify(jobs));
  const completedJob = jobs.find((job: { id: string }) => job.id === first.body.job.id);
  assert.equal(completedJob.status, 'PRINTED');
  assert.equal(completedJob.claimedByStationId, stationA);
});

test('a failed print can be manually recovered and claimed again', async () => {
  const order = await json(await createOrder(owner.token, branchAId));
  await acceptWithProductionPrintJob(order.id);
  const stationA = randomUUID();
  const claimed = await claimPrintJob(staffA.token, branchAId, stationA, 'RECEPCION-A');
  assert.equal(claimed.res.status, 201, JSON.stringify(claimed.body));

  const failed = await fetch(`${baseUrl}/printing/jobs/${claimed.body.job.id}/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ branchId: branchAId, stationId: stationA, error: 'Sin papel' }),
  });
  assert.equal(failed.status, 201);
  assert.equal((await json(failed)).status, 'FAILED');

  const retry = await fetch(`${baseUrl}/printing/jobs/${claimed.body.job.id}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffA.token}` },
    body: JSON.stringify({ branchId: branchAId }),
  });
  assert.equal(retry.status, 201);
  assert.equal((await json(retry)).status, 'PENDING');

  const reclaimed = await claimPrintJob(staffA.token, branchAId, stationA, 'RECEPCION-A');
  assert.equal(reclaimed.res.status, 201, JSON.stringify(reclaimed.body));
  assert.equal(reclaimed.body.job.id, claimed.body.job.id);
  assert.equal(reclaimed.body.job.status, 'CLAIMED');
  assert.equal(reclaimed.body.job.attempts, 2);
});
