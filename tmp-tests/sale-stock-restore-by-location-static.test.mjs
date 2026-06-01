import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20260509000001_multi_deposit_stock.sql');
const types = read('types/stock-location.ts');
const service = read('services/stockLocationService.ts');
const saleService = read('services/saleService.ts');
const estoque = read('Estoque.md');

assert.match(migration, /CREATE OR REPLACE FUNCTION restore_product_stock_from_sale_movements/, 'migration must define sale stock restore RPC');
assert.match(migration, /movement_type[\s\S]*'cancel'/, 'restore RPC must record cancel movements');
assert.match(migration, /FOR UPDATE/, 'restore RPC must lock movement or stock rows');
assert.match(migration, /PERFORM recalculate_product_stock_from_locations/, 'restore RPC must recalculate product totals');

assert.match(types, /StockLocationSaleRestoreInput/, 'types must define sale restore input');
assert.match(types, /StockLocationSaleRestoreResult/, 'types must define sale restore result');
assert.match(service, /async restoreSaleStockByLocation\(/, 'service must expose restoreSaleStockByLocation');
assert.match(service, /\/stock-locations\/sale-restores/, 'service must call the VPS sale restore endpoint');
assert.doesNotMatch(service, /rpc\('restore_product_stock_from_sale_movements'/, 'service must not call the old Supabase sale restore RPC');

assert.match(saleService, /restoreSaleStockForItems/, 'saleService must use a central restore helper');
assert.match(saleService, /restoreSaleStockByLocation/, 'saleService must try location restore');
assert.doesNotMatch(saleService, /supabase\.rpc\('increment_stock'/, 'saleService must not keep the old increment_stock fallback');
assert.match(saleService, /cancelSale[\s\S]*restoreSaleStockForItems/, 'cancelSale must restore through helper');
assert.match(saleService, /refundSale[\s\S]*restoreSaleStockForItems/, 'refundSale must restore through helper');
assert.match(saleService, /deleteSale[\s\S]*restoreSaleStockForItems/, 'deleteSale must restore through helper');

assert.match(estoque, /cancelamento\/estorno por local|estorno\/cancelamento por local/i, 'Estoque.md must document sale stock restore by location');

console.log('sale stock restore by location static checks passed');
