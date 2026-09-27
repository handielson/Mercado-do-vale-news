'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizePrint3dProductOffer } = require('../services/print3dProductOffer.cjs');

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

test('aceita SKU 3D sem peças prontas com prazo e limite próprios', () => {
  assert.deepEqual(normalizePrint3dProductOffer(valid()), {
    isPrint3d: 1, preorderEnabled: 1, limit: 8, days: 4,
  });
});

test('não exige política 3D nos produtos antigos', () => {
  assert.deepEqual(normalizePrint3dProductOffer({ name: 'Produto legado' }), {
    isPrint3d: null, preorderEnabled: null, limit: null, days: null,
  });
});

for (const [name, change] of [
  ['produto fora da linha 3D', { is_print3d: false }],
  ['sem controle de estoque', { track_inventory: false }],
  ['produto virtual', { is_virtual: true }],
  ['produto pai', { is_parent: true }],
  ['sem prazo individual', { production_days: null }],
  ['sem limite de unidades', { print3d_preorder_limit: null }],
  ['limite fracionário', { print3d_preorder_limit: 1.5 }],
]) {
  test(`rejeita encomenda: ${name}`, () => {
    assert.throws(() => normalizePrint3dProductOffer({ ...valid(), ...change }), (error) => error.statusCode === 400);
  });
}
