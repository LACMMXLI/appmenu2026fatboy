import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { bootstrapTestApp, uniqueSuffix, json } from './helpers/app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let baseUrl: string;
let app: Awaited<ReturnType<typeof bootstrapTestApp>>['app'];
let prisma: PrismaService;

let branchAmericasId: string;
let branchVeneciaId: string;
let productId: string;
let customer: { token: string; customer: { id: string } };

async function registerCustomer(suffix: string) {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Delivery Test ${suffix}`, phone: `686999${suffix}`.slice(-10), password: 'password123' }),
  });
  const body = await json(res);
  assert.equal(res.status, 201, JSON.stringify(body));
  return body as { token: string; customer: { id: string } };
}

before(async () => {
  const booted = await bootstrapTestApp();
  baseUrl = booted.baseUrl;
  app = booted.app;
  prisma = app.get(PrismaService);

  const category = await prisma.category.create({
    data: { id: randomUUID(), name: `Cat ${uniqueSuffix()}` },
  });
  const product = await prisma.product.create({
    data: {
      id: randomUUID(),
      name: 'Burger Test Delivery',
      price: 150.0,
      status: 'active',
      categoryId: category.id,
    },
  });
  productId = product.id;

  const branchAmericas = await prisma.branch.create({
    data: { id: randomUUID(), name: 'Sucursal Américas', phone: '6860000001' },
  });
  branchAmericasId = branchAmericas.id;

  const branchVenecia = await prisma.branch.create({
    data: { id: randomUUID(), name: 'Sucursal Venecia', phone: '6860000002' },
  });
  branchVeneciaId = branchVenecia.id;

  customer = await registerCustomer(uniqueSuffix());
});

after(async () => {
  await app?.close();
});

test('rechaza servicio a domicilio si la sucursal NO es Américas', async () => {
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({
      branchId: branchVeneciaId,
      deliveryType: 'delivery',
      deliveryAddress: 'Av. Paseo de los Héroes 1234',
      items: [{ id: productId, qty: 1 }],
    }),
  });
  const body = await json(res);
  assert.equal(res.status, 400);
  assert.match(body.message, /Américas/i);
});

test('rechaza servicio a domicilio si no se proporciona dirección válida', async () => {
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({
      branchId: branchAmericasId,
      deliveryType: 'delivery',
      deliveryAddress: '   ',
      items: [{ id: productId, qty: 1 }],
    }),
  });
  const body = await json(res);
  assert.equal(res.status, 400);
  assert.match(body.message, /dirección/i);
});

test('acepta servicio a domicilio en Américas y aplica el costo configurado dinámicamente', async () => {
  // Configurar costo de entrega a $2.50 en system_settings
  await prisma.systemSetting.upsert({
    where: { key: 'delivery_cost_americas' },
    update: { value: '2.50' },
    create: { key: 'delivery_cost_americas', value: '2.50' },
  });

  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({
      branchId: branchAmericasId,
      deliveryType: 'delivery',
      deliveryAddress: 'Calle Río Culiacán #450, Col. Prohogar',
      deliveryReference: 'Casa blanca portón negro',
      customerName: 'Juan Pérez',
      customerPhone: '6861234567',
      items: [{ id: productId, qty: 2 }], // 2 * 150 = 300
    }),
  });
  const body = await json(res);
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.equal(body.deliveryType, 'delivery');
  assert.equal(body.deliveryAddress, 'Calle Río Culiacán #450, Col. Prohogar');
  assert.equal(body.deliveryReference, 'Casa blanca portón negro');
  assert.equal(body.deliveryFee, 2.50);
  assert.equal(body.total, 302.50); // 300 + 2.50

  // Verificar en base de datos
  const dbOrder = await prisma.order.findUnique({ where: { id: body.id } });
  assert.ok(dbOrder);
  assert.equal(dbOrder.deliveryAddress, 'Calle Río Culiacán #450, Col. Prohogar');
  assert.equal(dbOrder.deliveryReference, 'Casa blanca portón negro');
  assert.equal(Number(dbOrder.deliveryFee), 2.50);
  assert.equal(Number(dbOrder.total), 302.50);
});
