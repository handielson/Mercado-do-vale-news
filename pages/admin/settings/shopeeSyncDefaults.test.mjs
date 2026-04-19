import assert from 'node:assert/strict';

import {
  normalizeShopeeDescription,
  resolveShopeeSyncDefaults,
} from './shopeeSyncDefaults.js';

const resultWithBling = resolveShopeeSyncDefaults(
  {
    name: 'Nome local',
    description: 'Descricao local',
    stock_quantity: 0,
  },
  {
    descricaoComplementar: '<p>Descricao <strong>Bling</strong></p>',
    stock_quantity: 7.9,
  }
);

assert.equal(resultWithBling.description, 'Descricao Bling');
assert.equal(resultWithBling.stock, 7);

const resultWithFallback = resolveShopeeSyncDefaults({
  name: 'Produto local',
  description: 'Linha 1<br>Linha 2',
  stock_quantity: 3,
});

assert.equal(resultWithFallback.description, 'Linha 1\nLinha 2');
assert.equal(resultWithFallback.stock, 3);

assert.equal(
  normalizeShopeeDescription('<p>Teste</p><p>Descricao</p>'),
  'Teste\n\nDescricao'
);

console.log('shopeeSyncDefaults.test.mjs: ok');
