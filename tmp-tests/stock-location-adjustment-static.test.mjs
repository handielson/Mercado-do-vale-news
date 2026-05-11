import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

const migration = read('supabase/migrations/20260509000001_multi_deposit_stock.sql');
const service = read('services/stockLocationService.ts');
const page = read('pages/admin/inventory/StockLocationsPage.tsx');
const types = read('types/stock-location.ts');

assertIncludes(migration, 'CREATE OR REPLACE FUNCTION adjust_product_stock_location', 'adjustment rpc');
assertIncludes(migration, 'FOR UPDATE', 'adjustment row lock');
assertIncludes(migration, 'target_quantity < 0', 'negative quantity validation');
assertIncludes(migration, 'target_quantity < current_reserved_quantity', 'reserved quantity validation');
assertIncludes(migration, 'target_quantity = current_quantity', 'unchanged quantity validation');
assertIncludes(migration, "movement_type,\n    reason,\n    reference_type", 'movement audit insert');
assertIncludes(migration, "'adjustment'", 'adjustment movement type');
assertIncludes(migration, 'PERFORM recalculate_product_stock_from_locations(target_product_id);', 'stock total recalculation');

assertIncludes(types, 'export interface StockLocationAdjustmentInput', 'adjustment input type');
assertIncludes(service, 'async adjustStockLocation(', 'adjust service method');
assertIncludes(service, "rpc('adjust_product_stock_location'", 'adjust service rpc');
assertIncludes(service, 'target_quantity: input.quantity', 'adjust quantity payload');
assertIncludes(service, 'adjustment_reason: input.reason', 'adjust reason payload');
assertIncludes(service, 'actor_id: user.data.user?.id || null', 'adjust actor payload');

assertIncludes(page, 'Ajustar saldo', 'adjust button/modal label');
assertIncludes(page, 'adjustStockLocation', 'page calls adjustment service');
assertIncludes(page, 'adjustmentReason', 'page requires reason');
assertIncludes(page, 'setAdjustmentError', 'page exposes adjustment errors');
assertIncludes(page, 'loadProductDistribution', 'page reloads selected product distribution');
assertIncludes(page, 'Motivo do ajuste', 'reason input label');
assert(page.includes('Transferir estoque'), 'transfer action should be available after adjustment step');

console.log('stock location adjustment static checks passed');
