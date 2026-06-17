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
  /Unidades vendidas[\s\S]*Pedido[\s\S]*Cliente[\s\S]*Venda[\s\S]*Lucro/,
  'model panel bottom unit table must show separate order and customer columns'
);
assert.match(
  page,
  /href=\{unit\.saleUrl \|\| unit\.orderUrl\}[\s\S]*unit\.orderNumber \|\| 'Abrir venda'/,
  'model panel sold unit order links must open the related sale directly when a sale exists'
);
assert.doesNotMatch(
  page,
  /unit\.orderNumber \|\| unit\.saleId \|\| unit\.orderId/,
  'model panel sold unit rows must not fall back to internal sale/order ids as the visible order label'
);

console.log('model panel sale item source static checks passed');
