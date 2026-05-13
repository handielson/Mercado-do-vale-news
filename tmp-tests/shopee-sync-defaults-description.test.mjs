import assert from 'node:assert/strict';
import {
  normalizeShopeeDescription,
  resolveShopeeSyncDefaults,
} from '../pages/admin/settings/shopeeSyncDefaults.js';

const formatted = normalizeShopeeDescription(`
  <p>&nbsp;</p>
  <p>Caracteristicas do Produto</p>
  <p><strong>Case flexivel</strong><br>Acabamento premium</p>
  <p>Conteudo da embalagem</p>
  <p>1 capa</p>
`);

assert.equal(
  formatted,
  'Caracteristicas do Produto\n\nCase flexivel\nAcabamento premium\n\nConteudo da embalagem\n\n1 capa',
  'Shopee description should preserve the new formatted description as clean text blocks'
);

const defaults = resolveShopeeSyncDefaults({
  description: '<p>Conteudo da embalagem</p><p>1 unidade</p>',
  stock_quantity: 3,
});

assert.equal(defaults.description, 'Conteudo da embalagem\n\n1 unidade');
assert.equal(defaults.stock, 3);

console.log('shopee sync defaults description tests passed');
