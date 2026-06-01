import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/migrate-stock-locations-supabase-to-vps.cjs', 'utf8');

for (const table of [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
]) {
  assert.match(source, new RegExp(`['"]${table}['"]`), `migrator must handle ${table}`);
}

assert.match(source, /Range: `\$\{offset\}-\$\{offset \+ SUPABASE_PAGE_SIZE - 1\}`/, 'migrator must page through Supabase rows');
assert.match(source, /\/admin\/stock-locations\/import/, 'migrator must use the transactional VPS stock import endpoint');
assert.match(source, /loadVpsColumns/, 'migrator must filter Supabase rows to columns that exist on the VPS');
assert.match(source, /--apply/, 'migrator must support dry-run by default and require --apply to mutate VPS');
assert.match(source, /withoutSecrets/, 'migrator logs must avoid printing env secrets');

console.log('stock location Supabase to VPS migrator static checks passed');
