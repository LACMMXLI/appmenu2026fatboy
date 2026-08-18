import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@prisma/client';
import { isTransitionAllowed, isOrderStatusValue } from '../src/modules/order/order-status.js';

// The exact transition matrix demanded by nuevo modulo.md (SIETE).
const ALLOWED: [OrderStatus, OrderStatus][] = [
  [OrderStatus.PENDING_APPROVAL, OrderStatus.ACCEPTED],
  [OrderStatus.PENDING_APPROVAL, OrderStatus.REJECTED],
  [OrderStatus.ACCEPTED, OrderStatus.PREPARING],
  [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING, OrderStatus.READY],
  [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.READY, OrderStatus.COMPLETED],
];

// Explicitly forbidden examples named in the document.
const FORBIDDEN: [OrderStatus, OrderStatus][] = [
  [OrderStatus.COMPLETED, OrderStatus.PREPARING],
  [OrderStatus.REJECTED, OrderStatus.ACCEPTED],
  [OrderStatus.PENDING_APPROVAL, OrderStatus.READY],
];

test('allows every documented transition', () => {
  for (const [from, to] of ALLOWED) {
    assert.equal(isTransitionAllowed(from, to), true, `${from} -> ${to} should be allowed`);
  }
});

test('rejects every documented forbidden transition', () => {
  for (const [from, to] of FORBIDDEN) {
    assert.equal(isTransitionAllowed(from, to), false, `${from} -> ${to} should be forbidden`);
  }
});

test('terminal states have no outgoing transitions', () => {
  const terminals: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.REJECTED, OrderStatus.CANCELLED];
  for (const terminal of terminals) {
    for (const to of Object.values(OrderStatus)) {
      assert.equal(isTransitionAllowed(terminal, to), false, `${terminal} -> ${to} should be forbidden`);
    }
  }
});

test('every status has at least one path to a terminal state', () => {
  // Sanity check against orphaned/dead-end non-terminal states.
  const terminals = new Set<OrderStatus>([OrderStatus.COMPLETED, OrderStatus.REJECTED, OrderStatus.CANCELLED]);
  for (const status of Object.values(OrderStatus)) {
    if (terminals.has(status)) continue;
    const reachable = new Set<OrderStatus>();
    const stack = [status];
    while (stack.length) {
      const current = stack.pop()!;
      for (const to of Object.values(OrderStatus)) {
        if (!reachable.has(to) && isTransitionAllowed(current, to)) {
          reachable.add(to);
          stack.push(to);
        }
      }
    }
    const canTerminate = [...reachable].some((s) => terminals.has(s));
    assert.equal(canTerminate, true, `${status} has no path to a terminal state`);
  }
});

test('isOrderStatusValue accepts only real enum values', () => {
  assert.equal(isOrderStatusValue('PENDING_APPROVAL'), true);
  assert.equal(isOrderStatusValue('pending'), false); // legacy lowercase value
  assert.equal(isOrderStatusValue('DROP TABLE orders'), false);
});
