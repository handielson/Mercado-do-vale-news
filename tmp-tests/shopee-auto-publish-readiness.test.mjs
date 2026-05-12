import assert from 'node:assert/strict';
import {
  evaluateShopeeAutoPublishReadiness,
  summarizeShopeeAutoPublishReadiness,
} from '../services/shopeeAutoPublishReadiness.ts';

const template = {
  id: 'phone_case',
  name: 'Capa de celular',
  active: true,
  priority: 100,
  rules: {
    nameIncludes: ['capa', 'case'],
    skuIncludes: ['capa'],
  },
  titleTemplate: 'Capa compativel com {modelo} Cor:{cor}',
  descriptionTemplate: '{nome}',
  shopeeCategoryId: 100490,
  shopeeCategoryName: 'Capas',
  attributeDefaults: { 100121: '3 Months' },
  priceMode: 'product',
  stockMode: 'product',
  dimensionMode: 'product',
  gtinMode: 'no_gtin',
  dangerousTerms: [
    {
      id: 'original',
      term: 'Original',
      replacement: '',
      level: 'block',
      active: true,
    },
  ],
};

const readyProduct = {
  product_id: 'p1',
  id: 'p1',
  status: 'not_synced',
  name: 'Capa para Redmi Note 13 Cor:Azul',
  sku: 'CAPA-RN13-AZUL',
  category_slug: 'capas',
  images: ['https://cdn.test/capa.jpg'],
  price_retail: 2490,
  stock_quantity: 5,
  track_inventory: true,
  specs: { color: 'Azul' },
};

const ready = evaluateShopeeAutoPublishReadiness(readyProduct, [template]);
assert.equal(ready.status, 'ready');
assert.equal(ready.template?.id, 'phone_case');
assert.deepEqual(ready.blockers, []);
assert.ok(ready.warnings.some((issue) => issue.code === 'fallback_dimensions'), 'safe fallback dimensions should be visible as a warning');

const missingImage = evaluateShopeeAutoPublishReadiness({ ...readyProduct, images: [] }, [template]);
assert.equal(missingImage.status, 'review');
assert.ok(missingImage.blockers.some((issue) => issue.code === 'missing_image'));

const blockedTitle = evaluateShopeeAutoPublishReadiness({ ...readyProduct, name: 'Capa Original para Redmi Note 13 Cor:Azul' }, [template]);
assert.equal(blockedTitle.status, 'review');
assert.ok(blockedTitle.blockers.some((issue) => issue.code === 'blocked_title_term'));

const noTemplate = evaluateShopeeAutoPublishReadiness({ ...readyProduct, name: 'Produto sem regra', sku: 'XYZ' }, [template]);
assert.equal(noTemplate.status, 'review');
assert.ok(noTemplate.blockers.some((issue) => issue.code === 'missing_template'));

const missingRequiredAttribute = evaluateShopeeAutoPublishReadiness(readyProduct, [template], {
  requiredAttributesByCategoryId: {
    100490: [
      { attribute_id: 100121, label: 'Garantia', mandatory: true },
      { attribute_id: 999999, label: 'Modelo obrigatorio', mandatory: true },
    ],
  },
  hasEnabledLogisticsChannel: true,
});
assert.equal(missingRequiredAttribute.status, 'review');
assert.ok(missingRequiredAttribute.blockers.some((issue) => issue.code === 'missing_required_attribute'));

const noLogistics = evaluateShopeeAutoPublishReadiness(readyProduct, [template], {
  requiredAttributesByCategoryId: {
    100490: [{ attribute_id: 100121, label: 'Garantia', mandatory: true }],
  },
  hasEnabledLogisticsChannel: false,
});
assert.equal(noLogistics.status, 'review');
assert.ok(noLogistics.blockers.some((issue) => issue.code === 'missing_logistics_channel'));

const summary = summarizeShopeeAutoPublishReadiness([
  ready,
  missingImage,
  blockedTitle,
  noTemplate,
]);
assert.equal(summary.ready, 1);
assert.equal(summary.review, 3);
assert.equal(summary.total, 4);

console.log('shopee auto publish readiness tests passed');
