import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20260509000001_multi_deposit_stock.sql');
const types = read('types/stock-location.ts');
const service = read('services/stockLocationService.ts');
const orderService = read('services/orderService.ts');
const estoque = read('Estoque.md');

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION restore_product_stock_from_order_movements/,
  'migration must define order stock restore RPC'
);

assert.match(
  migration,
  /reference_type\s*=\s*'order'/,
  'order restore RPC must find original order stock movements'
);

assert.match(
  migration,
  /reference_type[\s\S]*'order_restore'/,
  'order restore RPC must write idempotency marker as order_restore'
);

assert.match(
  types,
  /StockLocationOrderRestoreInput/,
  'types must define order restore input'
);

assert.match(
  types,
  /StockLocationOrderRestoreResult/,
  'types must define order restore result'
);

assert.match(
  service,
  /restoreOrderStockByLocation[\s\S]*restore_product_stock_from_order_movements/,
  'stockLocationService must expose restoreOrderStockByLocation using order restore RPC'
);

assert.match(
  orderService,
  /restoreOrderStockForItems/,
  'orderService must centralize order stock restore in a helper'
);

assert.match(
  orderService,
  /restoreOrderStockByLocation\s*\(/,
  'cancelOrder must attempt location restore before legacy fallback'
);

assert.match(
  orderService,
  /supabase\.rpc\(['"]increment_stock['"]/,
  'legacy increment_stock fallback must remain for orders paid before migration'
);

assert.match(
  orderService,
  /from\(['"]orders['"]\)[\s\S]*select\(['"][^'"]*payment_status[^'"]*status/,
  'cancelOrder must read order payment/status before deciding whether to restore numeric stock'
);

assert.match(
  orderService,
  /from\(['"]order_items['"]\)[\s\S]*select\(['"]product_id,\s*quantity['"]/,
  'cancelOrder fallback must fetch order items before restoring legacy numeric stock'
);

assert.match(
  orderService,
  /payment_status\s*===\s*['"]paid['"]|status\s*===\s*['"]completed['"]/,
  'cancelOrder must only restore numeric stock for orders that could already have decremented it'
);

assert.match(
  estoque,
  /Cancelamento\/liberacao de pedido online por local[^.\n]*conectado|pedido online[^.\n]*devolucao por local/i,
  'Estoque.md must document order cancel restore by location'
);

console.log('order stock restore by location static checks passed');
