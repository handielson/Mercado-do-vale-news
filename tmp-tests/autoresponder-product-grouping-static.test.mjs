import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function getAutoresponderProductGroupKey\(product\)/,
  'expected a product group key helper',
);

assert.match(
  source,
  /function getAutoresponderProductPrice\(product\)/,
  'expected a product price helper used by grouping and ranges',
);

assert.match(
  source,
  /function formatAutoresponderPriceRange\(products\)/,
  'expected a price range formatter for grouped product variations',
);

assert.match(
  source,
  /function groupAutoresponderProductsByModel\(products\)/,
  'expected products to be grouped by model',
);

assert.match(
  source,
  /model_id \|\| product\?\.id/,
  'expected grouping to prefer model_id and fall back to product id',
);

assert.match(
  source,
  /Math\.min\(\.\.\.prices\)/,
  'expected price range helper to calculate min price',
);

assert.match(
  source,
  /Math\.max\(\.\.\.prices\)/,
  'expected price range helper to calculate max price',
);

assert.match(
  source,
  /groupAutoresponderProductsByModel\(availableProducts\)/,
  'expected product search replies to use grouped available products',
);

assert.match(
  source,
  /priceRange/,
  'expected grouped replies to expose priceRange',
);

assert.match(
  source,
  /SELECT id, model_id, [^\n]+name, sku, slug, [^\n]+price_retail, price_promo, stock_quantity/,
  'expected autoresponder product queries to select model_id for grouping',
);

console.log('autoresponder product grouping static checks passed');
