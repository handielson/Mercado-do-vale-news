import assert from 'node:assert/strict';
import {
  findExistingShopeeItemIdForGroup,
  matchShopeeModelsBySku,
} from '../services/shopeeVariationLinking.ts';

const products = [
  { id: 'parent', sku: 'CAPA-RN13', parent_id: null },
  { id: 'black', sku: 'CAPA-RN13-PRETA', parent_id: 'parent', shopee_item_id: 123456 },
  { id: 'blue', sku: 'CAPA-RN13-AZUL', parent_id: 'parent', shopee_item_id: 123456 },
  { id: 'pink', sku: 'CAPA-RN13-ROSA', parent_id: 'parent' },
];

assert.equal(findExistingShopeeItemIdForGroup(products, products[3]), 123456);

const modelList = [
  { model_id: 9001, model_sku: 'CAPA-RN13-PRETA', tier_index: [0] },
  { model_id: 9002, model_sku: 'CAPA-RN13-AZUL', tier_index: [1] },
  { model_id: 9003, model_sku: 'CAPA-RN13-ROSA', tier_index: [2] },
];

const matches = matchShopeeModelsBySku(products.slice(1), modelList);
assert.equal(matches.get('black')?.shopee_model_id, 9001);
assert.equal(matches.get('pink')?.shopee_model_id, 9003);
assert.equal(matches.get('pink')?.shopee_model_sku, 'CAPA-RN13-ROSA');

console.log('shopee variation linking tests passed');
