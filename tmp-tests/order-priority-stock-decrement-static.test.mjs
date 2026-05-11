import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const orderService = read('services/orderService.ts');
const estoque = read('Estoque.md');

assert.match(
  orderService,
  /import\s+\{\s*stockLocationService\s*\}\s+from\s+['"]\.\/stockLocationService['"]/,
  'orderService must import stockLocationService'
);

assert.match(
  orderService,
  /decrementOrderItemStockByPriority/,
  'orderService must centralize priority decrement in a helper'
);

assert.match(
  orderService,
  /decrementStockByPriority\s*\(/,
  'online order numeric stock decrement must call decrementStockByPriority'
);

assert.match(
  orderService,
  /reference_type:\s*['"]order['"]/,
  'online order stock movement must be tagged as order'
);

assert.match(
  orderService,
  /reference_id:\s*orderId/,
  'online order stock movement must reference the order id'
);

assert.match(
  orderService,
  /supabase\.rpc\(['"]decrement_stock['"]/,
  'legacy decrement_stock fallback must remain while migration may not be deployed'
);

assert.match(
  orderService,
  /finalizeOrderStockByPriority[\s\S]*decrementOrderItemStockByPriority/,
  'order stock finalization must fall back to the priority decrement helper'
);

assert.match(
  orderService,
  /confirmPayment[\s\S]*finalizeOrderStockByPriority/,
  'confirmPayment must finalize numeric stock'
);

assert.match(
  orderService,
  /completeOnDeliveryOrder[\s\S]*finalizeOrderStockByPriority/,
  'completeOnDeliveryOrder must finalize numeric stock'
);

const createOrderStart = orderService.indexOf('export async function createOrder');
const getOrderStart = orderService.indexOf('export async function getOrderById', createOrderStart);
const createOrderBody = orderService.slice(createOrderStart, getOrderStart);

assert.doesNotMatch(
  createOrderBody,
  /decrementOrderItemStockByPriority|decrementStockByPriority|supabase\.rpc\(['"]decrement_stock['"]/,
  'createOrder must not decrement numeric stock'
);

assert.match(
  estoque,
  /pedido online[^.\n]*baixa por prioridade|baixa por prioridade[^.\n]*pedido online/i,
  'Estoque.md must document online order priority decrement status'
);

console.log('order priority stock decrement static checks passed');
