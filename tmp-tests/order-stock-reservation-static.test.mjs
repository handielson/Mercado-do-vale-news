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
  /CREATE OR REPLACE FUNCTION reserve_product_stock_by_priority/,
  'migration must define priority reservation RPC'
);

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION consume_order_stock_reservations/,
  'migration must define reservation consumption RPC'
);

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION release_order_stock_reservations/,
  'migration must define reservation release RPC'
);

assert.match(
  migration,
  /reserved_quantity\s*=\s*stock_row\.reserved_quantity\s*\+\s*reserve_quantity/,
  'reservation RPC must increase reserved_quantity without changing physical quantity'
);

assert.match(
  migration,
  /quantity\s*=\s*stock_row\.quantity\s*-\s*reservation_movement\.quantity[\s\S]*reserved_quantity\s*=\s*stock_row\.reserved_quantity\s*-\s*reservation_movement\.quantity/,
  'consume RPC must decrement both physical and reserved quantities'
);

assert.match(
  migration,
  /reserved_quantity\s*=\s*stock_row\.reserved_quantity\s*-\s*reservation_movement\.quantity/,
  'release RPC must decrease reserved_quantity'
);

assert.match(types, /StockLocationPriorityReservationInput/, 'types must define reservation input');
assert.match(types, /StockLocationPriorityReservationResult/, 'types must define reservation result');
assert.match(types, /StockLocationOrderReservationInput/, 'types must define order reservation input');

assert.match(
  service,
  /reserveStockByPriority[\s\S]*\/stock-locations\/priority-reservations/,
  'stockLocationService must expose reserveStockByPriority through VPS'
);

assert.match(
  service,
  /consumeOrderStockReservations[\s\S]*\/stock-locations\/order-reservations\/consume/,
  'stockLocationService must expose consumeOrderStockReservations through VPS'
);

assert.match(
  service,
  /releaseOrderStockReservations[\s\S]*\/stock-locations\/order-reservations\/release/,
  'stockLocationService must expose releaseOrderStockReservations through VPS'
);

assert.match(
  orderService,
  /reserveOrderStockByPriority/,
  'orderService must centralize online order reservation'
);

assert.match(
  orderService,
  /createOrder[\s\S]*reserveOrderStockByPriority/,
  'createOrder must reserve numeric stock after items are created'
);

assert.match(
  orderService,
  /consumeOrderStockReservations\s*\(/,
  'paid/completed orders must consume existing reservations before fallback decrement'
);

assert.match(
  orderService,
  /releaseOrderStockReservations\s*\(/,
  'pending cancelled orders must release existing reservations'
);

assert.match(
  orderService,
  /reference_type:\s*['"]order_reservation['"]/,
  'reservation movements must be tagged as order_reservation'
);

assert.match(
  estoque,
  /Reserva De Pedido Online Por Local|pedido online[^.\n]*reserva[^.\n]*Loja Principal/i,
  'Estoque.md must document online order stock reservation'
);

console.log('order stock reservation static checks passed');
