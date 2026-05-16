import assert from 'node:assert/strict';
import {
  buildShopeeOfferVariationGroup,
  buildShopeeOfferVariationGroups,
  getShopeeOfferVariationLabel,
  isShopeeOfferProduct,
} from '../services/shopeeOfferMapping.ts';

const baseProduct = {
  id: 'base-1',
  name: 'Capa Redmi Note 8',
  sku: 'CAPA-RN8',
  price_retail: 1490,
  stock_quantity: 10,
  track_inventory: true,
  specs: {},
};

const quantityOffer = {
  id: 'offer-1',
  name: '3x Capa Redmi Note 8',
  sku: 'CAPA-RN8-KIT3',
  offer_type: 'quantity_kit',
  offer_parent_product_id: 'base-1',
  shopee_strategy: 'variation',
  combo_children: [{ id: 'base-1', quantity: 3 }],
  price_retail: 3990,
  stock_quantity: 3,
  track_inventory: true,
  specs: {},
};

const separateOffer = {
  ...quantityOffer,
  id: 'offer-2',
  shopee_strategy: 'separate_item',
};

assert.equal(isShopeeOfferProduct(baseProduct), false);
assert.equal(isShopeeOfferProduct(quantityOffer), true);
assert.equal(getShopeeOfferVariationLabel(quantityOffer), 'Kit 3 un');

const group = buildShopeeOfferVariationGroup(quantityOffer, [baseProduct, quantityOffer]);
assert.equal(group?.children.length, 2);
assert.deepEqual(group?.children.map((child) => child.specs?.model), ['Unidade', 'Kit 3 un']);

assert.equal(buildShopeeOfferVariationGroup(separateOffer, [baseProduct, separateOffer]), null);
assert.equal(buildShopeeOfferVariationGroups([baseProduct, quantityOffer, separateOffer]).length, 1);

console.log('shopee offer mapping tests passed');
