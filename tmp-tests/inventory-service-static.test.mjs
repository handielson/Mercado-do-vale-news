import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../services/inventory.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/admin/inventory/InventoryPage.tsx', import.meta.url), 'utf8');

assert(
  !/from\('products'\)[\s\S]{0,80}\.select\('\*'\)/.test(service),
  'inventory service must not fetch every product column because product media makes /admin/inventory slow'
);

assert(
  !service.includes('product.unit_status') && !service.includes('price_cost, unit_status'),
  'inventory service must not query products.unit_status because that column does not exist in production'
);

assert(
  service.includes('sku.ilike') && service.includes('ean.ilike'),
  'inventory grouped search must include SKU and EAN'
);

assert(
  service.includes('buildProductSearchFilter(searchTerm)') && service.includes("].join(',')"),
  'inventory search filter must be sent to PostgREST as a single-line logic tree'
);

assert(
  service.includes('stock_quantity') && service.includes('Number(product.stock_quantity'),
  'inventory service must read stock from products.stock_quantity'
);

assert(
  page.includes('productRequestIdRef') && page.includes('requestId === productRequestIdRef.current'),
  'inventory page must ignore stale product searches so old requests cannot overwrite the latest filter'
);

console.log('inventory service static checks passed');
