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
}, {
  descricaoComplementar: '<p>Descricao Bling</p>',
  stock_quantity: 8,
  pesoBruto: 0.2,
  dimensoes: {
    largura: 8,
    altura: 2,
    profundidade: 17,
  },
});

assert.equal(defaults.description, 'Descricao Bling');
assert.equal(defaults.stock, 8);
assert.equal(defaults.weightKg, 0.2);
assert.deepEqual(defaults.dimensions, { width_cm: 8, height_cm: 2, depth_cm: 17 });

const rootPhysicalDefaults = resolveShopeeSyncDefaults({}, {
  pesoBruto: 0.3,
  largura: 9,
  altura: 3,
  profundidade: 18,
});

assert.equal(rootPhysicalDefaults.weightKg, 0.3);
assert.deepEqual(rootPhysicalDefaults.dimensions, { width_cm: 9, height_cm: 3, depth_cm: 18 });

const aspecPhysicalDefaults = resolveShopeeSyncDefaults({}, {
  aspec: {
    pesoBruto: 0.4,
    largura: 10,
    altura: 4,
    profundidade: 19,
  },
});

assert.equal(aspecPhysicalDefaults.weightKg, 0.4);
assert.deepEqual(aspecPhysicalDefaults.dimensions, { width_cm: 10, height_cm: 4, depth_cm: 19 });

console.log('shopee sync defaults description tests passed');
