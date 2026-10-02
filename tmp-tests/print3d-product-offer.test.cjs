'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizePrint3dProductOffer, applyPrint3dProductPolicy } = require('../services/print3dProductOffer.cjs');

const valid = () => ({
  is_print3d: true,
  print3d_preorder_enabled: true,
  print3d_preorder_limit: 8,
  production_days: 4,
  track_inventory: true,
  is_virtual: false,
  is_parent: false,
  stock_quantity: 0,
});

test('todo SKU 3D aceita encomenda, sem limite e com prazo a combinar', () => {
  assert.deepEqual(normalizePrint3dProductOffer(valid()), {
    isPrint3d: 1, preorderEnabled: 1, limit: null, days: null,
  });
  const payload = applyPrint3dProductPolicy({ ...valid(), print3d_preorder_enabled: false });
  assert.equal(payload.print3d_preorder_enabled, true);
  assert.equal(payload.print3d_preorder_limit, null);
  assert.equal(payload.production_days, null);
});

test('prazo e limite vazios deixam a encomenda sob consulta', () => {
  assert.deepEqual(normalizePrint3dProductOffer({ ...valid(), production_days:null, print3d_preorder_limit:null }), {
    isPrint3d:1, preorderEnabled:1, limit:null, days:null,
  });
  assert.deepEqual(normalizePrint3dProductOffer({ ...valid(), production_days:'  ', print3d_preorder_limit:'' }), {
    isPrint3d:1, preorderEnabled:1, limit:null, days:null,
  });
});

test('não exige política 3D nos produtos antigos', () => {
  assert.deepEqual(normalizePrint3dProductOffer({ name: 'Produto legado' }), {
    isPrint3d: null, preorderEnabled: null, limit: null, days: null,
  });
});

test('produto pai 3D organiza a família sem receber encomenda ou arquivo próprio', () => {
  const payload = { ...valid(), is_parent: true, track_inventory: false, print3d_preorder_enabled: true };
  assert.deepEqual(normalizePrint3dProductOffer(payload), {
    isPrint3d: 1, preorderEnabled: 0, limit: null, days: null,
  });
  assert.equal(payload.print3d_preorder_enabled, false);
  assert.equal(payload.print3d_preorder_limit, null);
  assert.equal(payload.production_days, null);
});

for (const [name, change] of [
  ['sem controle de estoque', { track_inventory: false }],
  ['produto virtual', { is_virtual: true }],
  ['limite fracionário', { print3d_preorder_limit: 1.5 }],
]) {
  test(`rejeita encomenda: ${name}`, () => {
    assert.throws(() => normalizePrint3dProductOffer({ ...valid(), ...change }), (error) => error.statusCode === 400);
  });
}
