import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = read('services/priorityStockDecrement.cjs');
const service = read('services/stockLocationService.ts');
const types = read('types/stock-location.ts');
const estoque = read('Estoque.md');
const saleService = read('services/saleService.ts');
const orderService = read('services/orderService.ts');

assert.match(runtime, /beginTransaction/, 'priority decrement must be transactional');
assert.match(runtime, /SELECT id FROM product_stock_locations[^\n]*FOR UPDATE/, 'priority decrement must lock only stock rows');
assert.match(runtime, /is_default DESC/, 'priority decrement must consume default deposit first');
assert.match(runtime, /insufficient_stock_by_location/, 'priority decrement must fail before partial decrement when total is insufficient');
assert.match(runtime, /INSERT INTO stock_location_movements/, 'priority decrement must record stock movement rows');
assert.match(runtime, /UPDATE products SET stock_quantity=/, 'priority decrement must keep products.stock_quantity in sync');

assert.match(types, /StockLocationPriorityDecrementInput/, 'types must define priority decrement input');
assert.match(types, /StockLocationPriorityDecrementResult/, 'types must define priority decrement result rows');
assert.match(service, /decrementStockByPriority/, 'service must expose decrementStockByPriority');
assert.match(service, /\/stock-locations\/priority-decrements/, 'service must call the VPS priority decrement endpoint');
assert.doesNotMatch(service, /rpc\('decrement_product_stock_by_priority'/, 'service must not call the old Supabase priority decrement RPC');

assert.match(saleService, /decrementStockByPriority/, 'PDV/sales must use priority decrement after PDV integration step');
assert.match(orderService, /decrementOrderItemStockByPriority[\s\S]*decrementStockByPriority/, 'online orders paid/completed must use priority decrement after order integration step');
assert.match(estoque, /baixa por prioridade/i, 'Estoque.md must document priority decrement');

console.log('stock location priority decrement static checks passed');
