import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/inventory.ts'), 'utf8');

const start = source.indexOf('async adjustStock(adjustment: StockAdjustmentInput): Promise<void> {');
const end = source.indexOf('async getMovements(productId: string', start);
assert(start >= 0 && end > start, 'Could not isolate inventory adjustStock block');

const block = source.slice(start, end);

assert(
  /vpsApiService\.getProductById\(adjustment\.product_id,\s*true\)/.test(block),
  'adjustStock should read the current product from VPS before calculating stock',
);

assert(
  !/\.from\('products'\)[\s\S]{0,160}\.select\('stock_quantity'\)/.test(block),
  'adjustStock must not read current stock directly from Supabase products',
);

assert(
  /supabase\s*\.\s*from\('products'\)[\s\S]{0,160}\.update\(\{\s*stock_quantity: newQty\s*\}\)/.test(block),
  'adjustStock should keep the existing Supabase stock write until the write path is migrated',
);

console.log('inventory adjustStock reads current product from VPS');
