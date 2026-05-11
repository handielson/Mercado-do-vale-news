import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260509000001_multi_deposit_stock.sql';
const sql = readFileSync(migrationPath, 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

for (const table of [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
]) {
  assert.match(normalized, new RegExp(`create table if not exists ${table}`), `${table} table should be created`);
  assert.match(normalized, new RegExp(`alter table ${table} enable row level security`), `${table} should enable RLS`);
}

for (const requiredColumn of [
  'company_id uuid not null references companies',
  'deposit_id uuid not null references stock_deposits',
  'location_id uuid not null references stock_locations',
  'product_id uuid not null references products',
  'reserved_quantity integer not null default 0',
  'from_deposit_id uuid references stock_deposits',
  'to_deposit_id uuid references stock_deposits',
  'reference_type text',
]) {
  assert.ok(normalized.includes(requiredColumn), `migration should include column fragment: ${requiredColumn}`);
}

assert.ok(normalized.includes('unique(company_id, code)'), 'deposits should protect duplicate company codes');
assert.ok(normalized.includes('unique(deposit_id, code)'), 'locations should protect duplicate location codes inside a deposit');
assert.ok(
  normalized.includes('unique(product_id, deposit_id, location_id)'),
  'product_stock_locations should have one balance per product/deposit/location',
);

assert.ok(normalized.includes("loja principal"), 'migration should create the default deposit');
assert.ok(normalized.includes("estoque geral"), 'migration should create the default location');
assert.ok(normalized.includes('initial_migration'), 'migration should record initial stock movements');
assert.ok(normalized.includes('stock_location_divergences'), 'migration should expose a divergence view');
assert.ok(normalized.includes('coalesce(p.stock_quantity, 0)'), 'migration should compare local stock with products.stock_quantity');

assert.ok(
  normalized.includes('create or replace function ensure_default_stock_location'),
  'migration should expose a function to ensure default deposit/location by company',
);
assert.ok(
  normalized.includes('create or replace function recalculate_product_stock_from_locations'),
  'migration should expose a function to recalculate products.stock_quantity from local balances',
);
assert.ok(
  normalized.includes('sum(quantity)'),
  'recalculate_product_stock_from_locations should sum product_stock_locations.quantity',
);
assert.ok(!normalized.includes('security definer'), 'stock helper functions should not bypass RLS');

console.log('multi-deposit stock migration static checks passed');
