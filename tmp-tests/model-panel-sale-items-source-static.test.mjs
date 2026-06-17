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
assert.match(
  page,
  /Unidades vendidas[\s\S]*Pedido[\s\S]*Venda[\s\S]*Lucro/,
  'model panel bottom unit table must focus on sold units with order, sale value and profit'
);
assert.match(
  page,
  /unit\.orderUrl \|\| unit\.saleUrl[\s\S]*href=\{unit\.saleUrl \|\| unit\.orderUrl\}[\s\S]*unit\.orderNumber/,
  'model panel sold unit rows must link directly to the related order/sale'
);

console.log('model panel sale item source static checks passed');
