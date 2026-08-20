import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { OrderController } from '../src/modules/order/order.controller.js';
import { OrderService } from '../src/modules/order/order.service.js';

const CONFIRMATION = 'ELIMINAR TODOS LOS PEDIDOS';

test('deleteAllOrders removes order-owned records and preserves customers', async () => {
  let purgedNotification = 0;
  const tx = {
    orderItem: { count: async () => 8 },
    orderStatusHistory: { count: async () => 5 },
    orderPrintJob: { count: async () => 2 },
    customer: { count: async () => 4 },
    order: { deleteMany: async () => ({ count: 3 }) },
  };
  const prisma = {
    $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
  };
  const gateway = {
    notifyOrdersPurged: (deletedOrders: number) => {
      purgedNotification = deletedOrders;
    },
  };
  const service = new OrderService(prisma as never, gateway as never);

  const result = await service.deleteAllOrders();

  assert.deepEqual(result, {
    deletedOrders: 3,
    deletedOrderItems: 8,
    deletedStatusHistory: 5,
    deletedPrintJobs: 2,
    preservedCustomers: 4,
  });
  assert.equal(purgedNotification, 3);
  assert.equal('deleteMany' in tx.customer, false, 'the cleanup must never delete customer accounts');
});

test('deleteAllOrders does not broadcast when there was nothing to delete', async () => {
  let notificationSent = false;
  const tx = {
    orderItem: { count: async () => 0 },
    orderStatusHistory: { count: async () => 0 },
    orderPrintJob: { count: async () => 0 },
    customer: { count: async () => 7 },
    order: { deleteMany: async () => ({ count: 0 }) },
  };
  const service = new OrderService(
    { $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) } as never,
    { notifyOrdersPurged: () => { notificationSent = true; } } as never,
  );

  const result = await service.deleteAllOrders();

  assert.equal(result.deletedOrders, 0);
  assert.equal(result.preservedCustomers, 7);
  assert.equal(notificationSent, false);
});

test('only an ADMIN with the exact confirmation can delete all orders', async () => {
  let serviceCalls = 0;
  let role: StaffRole = StaffRole.STAFF;
  const controller = new OrderController(
    {
      deleteAllOrders: async () => {
        serviceCalls += 1;
        return { deletedOrders: 2 };
      },
    } as never,
    {} as never,
    {
      validateSession: async () => ({ role }),
    } as never,
  );

  await assert.rejects(
    () => controller.deleteAllOrders('Bearer staff-token', CONFIRMATION),
    ForbiddenException,
  );
  assert.equal(serviceCalls, 0);

  role = StaffRole.ADMIN;
  await assert.rejects(
    () => controller.deleteAllOrders('Bearer admin-token', 'ELIMINAR PEDIDOS'),
    BadRequestException,
  );
  assert.equal(serviceCalls, 0);

  const result = await controller.deleteAllOrders('Bearer admin-token', CONFIRMATION);
  assert.deepEqual(result, { deletedOrders: 2 });
  assert.equal(serviceCalls, 1);
});
