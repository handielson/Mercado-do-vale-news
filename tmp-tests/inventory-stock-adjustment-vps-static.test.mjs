import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/inventory.ts'), 'utf8');

const start = source.indexOf('async adjustStock(adjustment: StockAdjustmentInput): Promise<void> {');
const end = source.indexOf('async getMovements(productId: string', start);
assert(start >= 0 && end > start, 'Could not isolate inventory adjustStock block');

const block = source.slice(start, end);

assert.match(
  source,
  /import\s+\{\s*vpsClient\s+\}\s+from\s+['"]\.\/vpsClient['"]/,
  'inventory service should use vpsClient for stock movement table-data',
);

assert.match(
  block,
  /vpsApiService\.updateProduct\(adjustment\.product_id,[\s\S]*stock_quantity:\s*newQty/,
  'adjustStock should write product stock through the VPS product API',
);

assert.match(
  block,
  /vpsClient\.post<StockMovement>\([\s\S]*['"]\/table-data\/stock_movements['"]/,
  'adjustStock should record stock movements through VPS table-data',
);

assert.doesNotMatch(
  block,
  /from\(['"]products['"]\)/,
  'adjustStock must not update product stock directly through Supabase',
);

assert.doesNotMatch(
  source,
  /from\(['"]stock_movements['"]\)/,
  'inventory service must not read or write stock_movements directly through Supabase',
);

assert.match(
  source,
  /loadStockMovementRows\(\)/,
  'inventory service should load stock movement history from VPS table-data',
);

console.log('inventory stock adjustment VPS static checks passed');
