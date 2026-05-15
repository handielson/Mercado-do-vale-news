import assert from 'node:assert/strict';
import {
  buildBlingPriceTargetSkus,
  buildBlingPriceStockPayload,
  shouldFanOutBlingParentPrice,
} from '../api/_lib/bling-price-targets.js';

const children = [
  { sku: 'CCI126.1AZ' },
  { sku: 'CCI126.1VIN' },
  { sku: 'CCI126.1AZ' },
  { sku: '' },
  null,
];

assert.equal(
  shouldFanOutBlingParentPrice({ blingId: 15975729092, priceRetail: 1499 }),
  true,
  'parent product price webhooks with a valid Bling id and price must fan out to children',
);

assert.deepEqual(
  buildBlingPriceTargetSkus('CCI126.1', children),
  ['CCI126.1', 'CCI126.1AZ', 'CCI126.1VIN'],
  'parent product price sync must include the parent SKU and every unique child SKU',
);

assert.deepEqual(
  buildBlingPriceStockPayload(['CCI126.1', 'CCI126.1AZ', 'CCI126.1VIN'], { price_retail: 1499, name: 'Do not send name' }),
  {
    products: [
      { sku: 'CCI126.1', price_retail: 1499 },
      { sku: 'CCI126.1AZ', price_retail: 1499 },
      { sku: 'CCI126.1VIN', price_retail: 1499 },
    ],
  },
  'price fan-out payload must send only commercial price fields to /products/prices-stock',
);

console.log('bling parent price target helpers ok');
