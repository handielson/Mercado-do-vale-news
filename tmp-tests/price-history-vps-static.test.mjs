import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/priceHistoryService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /\.from\('product_price_history'\)/,
  'product_price_history must not use Supabase after VPS migration',
);

assert.match(
  service,
  /\/table-data\/product_price_history\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'price history reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<PriceSnapshot>\('\/table-data\/product_price_history'/,
  'price history inserts should use VPS table-data',
);

assert.match(
  service,
  /vpsApiService\.updateProduct\(id,\s*\{[\s\S]*price_wholesale:\s*newPrices\.price_wholesale/,
  'variation price updates should write product prices through the VPS product API',
);

assert.doesNotMatch(
  service,
  /\.from\('products'\)|import\s+\{\s*supabase\s*\}/,
  'price history service must not update products directly through Supabase',
);

console.log('price history VPS static checks passed');
