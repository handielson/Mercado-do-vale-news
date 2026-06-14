import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');

assert.match(
  page,
  /loadTableRows\('sales'\)/,
  'model panel must load sales rows to ignore cancelled/refunded sales when counting sold items'
);
assert.match(
  page,
  /loadTableRows\('sale_items'\)/,
  'model panel must load sale_items so non-serialized PDV sales are counted'
);
assert.match(
  page,
  /aggregateModelProducts\(\{[\s\S]*sales,[\s\S]*saleItems,/,
  'model panel must pass sales and saleItems into aggregateModelProducts'
);

console.log('model panel sale item source static checks passed');
