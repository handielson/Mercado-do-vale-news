import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20260509000001_multi_deposit_stock.sql');
const types = read('types/stock-location.ts');
const service = read('services/stockLocationService.ts');
const page = read('pages/admin/inventory/StockLocationsPage.tsx');
const estoque = read('Estoque.md');

assert.match(migration, /CREATE OR REPLACE FUNCTION add_product_stock_location/, 'migration must define stock entry RPC');
assert.match(migration, /movement_type[\s\S]*'in'/, 'stock entry must record movement_type in');
assert.match(migration, /FOR UPDATE/, 'stock entry must lock the target row when it exists');
assert.match(migration, /PERFORM recalculate_product_stock_from_locations/, 'stock entry must recalculate products.stock_quantity');

assert.match(types, /StockLocationEntryInput/, 'types must define stock entry input');
assert.match(service, /async addStockLocation\(/, 'service must expose addStockLocation');
assert.match(service, /rpc\('add_product_stock_location'/, 'service must call stock entry RPC');

assert.match(page, /Entrada de estoque/, 'locations page must expose stock entry action');
assert.match(page, /addStockLocation/, 'locations page must call stock entry service method');
assert.match(page, /entryReason/, 'entry modal must require a reason field');

assert.match(estoque, /Entrada operacional de estoque|entrada operacional de estoque/i, 'Estoque.md must document stock entry status');

console.log('stock location entry static checks passed');
