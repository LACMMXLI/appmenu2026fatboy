import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCorsOrigin } from '../src/lib/cors.js';

test('CORS conserva los orígenes web y agrega el origen de Electron', () => {
  assert.deepEqual(
    resolveCorsOrigin('https://menu.example, https://pedidos.example', 'fatboy://app'),
    ['https://menu.example', 'https://pedidos.example', 'fatboy://app'],
  );
});

test('CORS no duplica el origen de Electron', () => {
  assert.deepEqual(
    resolveCorsOrigin('https://pedidos.example,fatboy://app', 'fatboy://app'),
    ['https://pedidos.example', 'fatboy://app'],
  );
});

test('CORS permite deshabilitar explícitamente el origen de Electron', () => {
  assert.deepEqual(resolveCorsOrigin('https://pedidos.example', ''), ['https://pedidos.example']);
});

test('CORS conserva la configuración abierta con asterisco', () => {
  assert.equal(resolveCorsOrigin('*', 'fatboy://app'), true);
});
