import assert from 'node:assert/strict';
import { areMenuPromotionsOpen } from './promotion-window.js';

assert.equal(areMenuPromotionsOpen(new Date('2026-07-18T03:59:00.000Z')), true);
assert.equal(areMenuPromotionsOpen(new Date('2026-07-18T04:00:00.000Z')), false);

console.log('promotion-window self-check ok');
