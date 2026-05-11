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
const plan = read('Estoque.md');

assertIncludes(migration, 'CREATE OR REPLACE FUNCTION transfer_product_stock_location', 'transfer rpc');
assertIncludes(migration, 'FOR UPDATE', 'transfer row lock');
assertIncludes(migration, 'transfer_quantity <= 0', 'positive transfer quantity validation');
assertIncludes(migration, 'from_available_quantity', 'available source quantity validation');
assertIncludes(migration, 'source_reserved_quantity', 'reserved source preservation');
assertIncludes(migration, 'target_reserved_quantity', 'target reserved preservation');
assertIncludes(migration, 'from_deposit_id,\n    from_location_id,\n    to_deposit_id,\n    to_location_id', 'transfer movement locations');
assertIncludes(migration, "'transfer'", 'transfer movement type');
assert(!migration.includes('PERFORM recalculate_product_stock_from_locations(target_product_id); -- transfer'), 'transfer should not change total stock');

assertIncludes(types, 'export interface StockLocationTransferInput', 'transfer input type');
assertIncludes(service, 'async transferStockLocation(', 'transfer service method');
assertIncludes(service, "rpc('transfer_product_stock_location'", 'transfer service rpc');
assertIncludes(service, 'from_deposit_id: input.from_deposit_id', 'transfer source deposit payload');
assertIncludes(service, 'from_location_id: input.from_location_id', 'transfer source location payload');
assertIncludes(service, 'to_deposit_id: input.to_deposit_id', 'transfer target deposit payload');
assertIncludes(service, 'to_location_id: input.to_location_id', 'transfer target location payload');
assertIncludes(service, 'transfer_quantity: quantity', 'transfer quantity payload');
assertIncludes(service, 'transfer_reason: input.reason.trim()', 'transfer reason payload');

assertIncludes(page, 'Transferir estoque', 'transfer button/modal label');
assertIncludes(page, 'transferStockLocation', 'page calls transfer service');
assertIncludes(page, 'transferReason', 'page requires reason');
assertIncludes(page, 'Origem', 'source section label');
assertIncludes(page, 'Destino', 'target section label');
assertIncludes(page, 'Saldo disponÃ­vel na origem', 'available source label');
assertIncludes(page, 'origem e destino precisam ser diferentes', 'same location validation');
assertIncludes(page, 'quantidade disponivel na origem', 'available quantity validation');
assertIncludes(page, 'stockLocationService.listMovements({ limit: 20 }).then(setMovements)', 'page reloads movements after transfer');

assertIncludes(plan, '- [x] Criar modal de transferencia.', 'plan marks transfer modal done');
assertIncludes(plan, '- [x] Integrar transferencia.', 'plan marks transfer flow done');
assertIncludes(plan, 'Criada funcao SQL `transfer_product_stock_location`', 'production diary records transfer rpc');

console.log('stock location transfer static checks passed');
