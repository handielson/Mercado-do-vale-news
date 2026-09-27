'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  canUseMercadoDoValeOrderAutomation, isLegacyMdvOrderCreate, isLegacyMdvOrderPatch,
} = require('../services/orderStorefront.cjs');

test('automação do Mercado do Vale aceita seus pedidos e os legados sem origem', () => {
  assert.equal(canUseMercadoDoValeOrderAutomation({ id: 'old-1' }), true);
  assert.equal(canUseMercadoDoValeOrderAutomation({ id: 'mdv-1', storefront: 'mercado_do_vale' }), true);
});

test('automação do Mercado do Vale recusa pedidos 3D e origens desconhecidas', () => {
  assert.equal(canUseMercadoDoValeOrderAutomation({ id: '3d-1', storefront: 'loja_3d' }), false);
  assert.equal(canUseMercadoDoValeOrderAutomation({ id: 'other-1', storefront: 'outro_site' }), false);
  assert.equal(canUseMercadoDoValeOrderAutomation({ id: 'empty-1', storefront: '' }), false);
  assert.equal(canUseMercadoDoValeOrderAutomation(null), false);
});

test('rota legada só cria pedidos MDV e não altera a origem depois', () => {
  assert.equal(isLegacyMdvOrderCreate({ customer_name: 'A' }), true);
  assert.equal(isLegacyMdvOrderCreate({ storefront: 'mercado_do_vale' }), true);
  assert.equal(isLegacyMdvOrderCreate({ storefront: 'loja_3d' }), false);
  assert.equal(isLegacyMdvOrderCreate({ storefront: '' }), false);
  assert.equal(isLegacyMdvOrderPatch({ status: 'preparing' }), true);
  assert.equal(isLegacyMdvOrderPatch({ storefront: 'mercado_do_vale' }), false);
});

// Both deployable entrypoints must wire the tested policy, including the JS alias used by PM2.
for (const entry of ['vps_server.js','vps_server.cjs']) test(entry + ': integra proteção dos pedidos 3D em automações e pagamentos MDV', () => {
  const source = fs.readFileSync(entry,'utf8');
  assert.equal((source.match(/canUseMercadoDoValeOrderAutomation\(/g) || []).length, 8);
  assert.equal((source.match(/isLegacyMdvOrderCreate\(/g) || []).length, 2);
  assert.equal((source.match(/isLegacyMdvOrderPatch\(/g) || []).length, 1);
});
