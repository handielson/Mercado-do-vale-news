import assert from 'node:assert/strict';
import {
  buildShopeeVariationModels,
  detectShopeeVariationDimensions,
  groupShopeeVariationCandidates,
  validateShopeeVariationGroup,
} from '../services/shopeeVariationEngine.ts';

const products = [
  {
    id: 'parent',
    name: 'Capa Redmi Note 13',
    sku: 'CAPA-RN13',
    parent_id: null,
    is_parent: true,
    price_retail: 1990,
    stock_quantity: 0,
    images: ['https://cdn.test/parent.jpg'],
    specs: {},
  },
  {
    id: 'red',
    name: 'Capa Redmi Note 13 Cor:Vermelho',
    sku: 'CAPA-RN13-RED',
    parent_id: 'parent',
    price_retail: 1990,
    stock_quantity: 4,
    images: ['https://cdn.test/red.jpg'],
    eans: ['7890000000011'],
    specs: { color: 'Vermelho' },
  },
  {
    id: 'blue',
    name: 'Capa Redmi Note 13 Cor:Azul',
    sku: 'CAPA-RN13-BLUE',
    parent_id: 'parent',
    price_retail: 2090,
    stock_quantity: 2,
    images: ['https://cdn.test/blue.jpg'],
    eans: ['7890000000012'],
    specs: { color: 'Azul' },
  },
];

const groups = groupShopeeVariationCandidates(products);
assert.equal(groups.length, 1);
assert.equal(groups[0].parent.id, 'parent');
assert.deepEqual(groups[0].children.map((child) => child.sku), ['CAPA-RN13-RED', 'CAPA-RN13-BLUE']);

const dimensions = detectShopeeVariationDimensions(groups[0]);
assert.deepEqual(dimensions, [{ name: 'Cor', key: 'color', options: ['Vermelho', 'Azul'] }]);

const validation = validateShopeeVariationGroup(groups[0], dimensions);
assert.equal(validation.ok, true);
assert.deepEqual(validation.blockers, []);

const payloadParts = buildShopeeVariationModels(groups[0], dimensions, {
  imageIdsByProductId: { red: 'sg-red', blue: 'sg-blue' },
  stockByProductId: { red: 4, blue: 2 },
});

assert.deepEqual(payloadParts.tier_variation, [
  {
    name: 'Cor',
    option_list: [
      { option: 'Vermelho', image: { image_id: 'sg-red' } },
      { option: 'Azul', image: { image_id: 'sg-blue' } },
    ],
  },
]);

assert.deepEqual(payloadParts.model_list, [
  {
    tier_index: [0],
    model_sku: 'CAPA-RN13-RED',
    original_price: 19.9,
    seller_stock: [{ stock: 4 }],
    gtin_code: '7890000000011',
    tax_info: { gtin: '7890000000011' },
  },
  {
    tier_index: [1],
    model_sku: 'CAPA-RN13-BLUE',
    original_price: 20.9,
    seller_stock: [{ stock: 2 }],
    gtin_code: '7890000000012',
    tax_info: { gtin: '7890000000012' },
  },
]);

console.log('shopee variation engine tests passed');
