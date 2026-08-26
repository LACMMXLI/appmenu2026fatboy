import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { bootstrapTestApp, json, uniqueSuffix } from './helpers/app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let baseUrl: string;
let app: Awaited<ReturnType<typeof bootstrapTestApp>>['app'];
let prisma: PrismaService;
let branchId: string;
let otherBranchId: string;
let productId: string;
let customer: { token: string; customer: { id: string } };
let dispatcher: { token: string; staff: { id: string } };
let driver: { token: string; staff: { id: string } };
let otherDriver: { token: string; staff: { id: string } };

async function createStaff(role: 'STAFF' | 'DRIVER', assignedBranchId: string) {
  const suffix = uniqueSuffix();
  const username = `${role.toLowerCase()}_${suffix}`;
  const created = await fetch(`${baseUrl}/admin/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_CATALOG_KEY! },
    body: JSON.stringify({ name: `${role} ${suffix}`, username, password: 'password123', role, branchId: assignedBranchId }),
  });
  assert.equal(created.status, 201, JSON.stringify(await json(created.clone())));
  const login = await fetch(`${baseUrl}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' }),
  });
  const body = await json(login);
  assert.equal(login.status, 201, JSON.stringify(body));
  return body as { token: string; staff: { id: string } };
}

async function createReadyDeliveryOrder() {
  const created = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({
      branchId,
      deliveryType: 'delivery',
      deliveryAddress: 'Av. República de Brasil 990, Col. Cuauhtémoc',
      deliveryReference: 'Portón negro frente al parque',
      paymentMethod: 'cash',
      items: [{ id: productId, qty: 1 }],
    }),
  });
  const order = await json(created);
  assert.equal(created.status, 201, JSON.stringify(order));

  const accept = await fetch(`${baseUrl}/orders/${order.id}/accept`, {
    method: 'POST', headers: { Authorization: `Bearer ${dispatcher.token}` },
  });
  assert.equal(accept.status, 201, JSON.stringify(await json(accept.clone())));
  for (const status of ['PREPARING', 'READY']) {
    const advanced = await fetch(`${baseUrl}/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dispatcher.token}` },
      body: JSON.stringify({ status }),
    });
    assert.equal(advanced.status, 200, JSON.stringify(await json(advanced.clone())));
  }
  return order;
}

async function assign(orderId: string, driverId = driver.staff.id) {
  const response = await fetch(`${baseUrl}/orders/${orderId}/delivery/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dispatcher.token}` },
    body: JSON.stringify({ driverId }),
  });
  return { response, body: await json(response) };
}

before(async () => {
  if (!process.env.ADMIN_CATALOG_KEY) throw new Error('ADMIN_CATALOG_KEY is required.');
  const booted = await bootstrapTestApp();
  app = booted.app;
  baseUrl = booted.baseUrl;
  prisma = app.get(PrismaService);

  branchId = randomUUID();
  otherBranchId = randomUUID();
  await prisma.branch.createMany({
    data: [
      { id: branchId, name: `Sucursal Américas ${uniqueSuffix()}`, phone: '6865550101' },
      { id: otherBranchId, name: `Sucursal Venecia ${uniqueSuffix()}`, phone: '6865550102' },
    ],
  });
  const category = await prisma.category.create({ data: { id: randomUUID(), name: `Reparto ${uniqueSuffix()}` } });
  const product = await prisma.product.create({
    data: { id: randomUUID(), name: 'Hamburguesa reparto', price: 180, categoryId: category.id, status: 'active' },
  });
  productId = product.id;

  const suffix = uniqueSuffix();
  const registered = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cliente Reparto', phone: `686${suffix}`.slice(-10), password: 'password123' }),
  });
  customer = await json(registered);
  assert.equal(registered.status, 201, JSON.stringify(customer));
  dispatcher = await createStaff('STAFF', branchId);
  driver = await createStaff('DRIVER', branchId);
  otherDriver = await createStaff('DRIVER', otherBranchId);
});

after(async () => {
  await app?.close();
});

test('only an active driver from the same branch can receive a READY delivery', async () => {
  const order = await createReadyDeliveryOrder();
  const wrongBranch = await assign(order.id, otherDriver.staff.id);
  assert.equal(wrongBranch.response.status, 400);

  const assigned = await assign(order.id);
  assert.equal(assigned.response.status, 201, JSON.stringify(assigned.body));
  assert.equal(assigned.body.status, 'ASSIGNED');
  assert.equal(assigned.body.driverId, driver.staff.id);
  assert.equal(assigned.body.order.id, order.id);
});

test('a DRIVER cannot browse the branch order board or operate another driver task', async () => {
  const order = await createReadyDeliveryOrder();
  const assigned = await assign(order.id);
  assert.equal(assigned.response.status, 201);

  const board = await fetch(`${baseUrl}/admin/orders?branchId=${branchId}`, {
    headers: { Authorization: `Bearer ${driver.token}` },
  });
  assert.equal(board.status, 403);

  const otherStart = await fetch(`${baseUrl}/deliveries/${assigned.body.id}/start`, {
    method: 'POST', headers: { Authorization: `Bearer ${otherDriver.token}` },
  });
  assert.equal(otherStart.status, 403);
});

test('the driver flow ASSIGNED -> INCIDENT -> EN_ROUTE -> DELIVERED closes the order atomically', async () => {
  const order = await createReadyDeliveryOrder();
  const assigned = await assign(order.id);
  assert.equal(assigned.response.status, 201);

  const mine = await fetch(`${baseUrl}/deliveries/mine`, { headers: { Authorization: `Bearer ${driver.token}` } });
  const mineBody = await json(mine);
  assert.equal(mine.status, 200);
  assert.ok(mineBody.some((task: { id: string }) => task.id === assigned.body.id));

  const genericComplete = await fetch(`${baseUrl}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dispatcher.token}` },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert.equal(genericComplete.status, 403);

  const incident = await fetch(`${baseUrl}/deliveries/${assigned.body.id}/incident`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driver.token}` },
    body: JSON.stringify({ reason: 'El cliente no responde.' }),
  });
  assert.equal(incident.status, 201);
  assert.equal((await json(incident)).status, 'INCIDENT');

  const start = await fetch(`${baseUrl}/deliveries/${assigned.body.id}/start`, {
    method: 'POST', headers: { Authorization: `Bearer ${driver.token}` },
  });
  assert.equal(start.status, 201);
  assert.equal((await json(start)).status, 'EN_ROUTE');

  const completed = await fetch(`${baseUrl}/deliveries/${assigned.body.id}/complete`, {
    method: 'POST', headers: { Authorization: `Bearer ${driver.token}` },
  });
  const completedBody = await json(completed);
  assert.equal(completed.status, 201, JSON.stringify(completedBody));
  assert.equal(completedBody.status, 'DELIVERED');
  assert.equal(completedBody.order.status, 'COMPLETED');

  const storedTask = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: assigned.body.id }, include: { events: true } });
  const storedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { statusHistory: true } });
  assert.equal(storedTask.status, 'DELIVERED');
  assert.ok(storedTask.deliveredAt);
  assert.equal(storedOrder.status, 'COMPLETED');
  assert.equal(storedOrder.pointsCredited, true);
  assert.deepEqual(storedTask.events.map((event) => event.toStatus), ['ASSIGNED', 'INCIDENT', 'EN_ROUTE', 'DELIVERED']);
  assert.equal(storedOrder.statusHistory.at(-1)?.staffId, driver.staff.id);
});
