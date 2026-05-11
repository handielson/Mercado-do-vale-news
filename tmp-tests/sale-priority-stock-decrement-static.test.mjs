import fs from 'node:fs';
import assert from 'node:assert/strict';

const saleService = fs.readFileSync('services/saleService.ts', 'utf8');
const orderService = fs.readFileSync('services/orderService.ts', 'utf8');
const estoqueDoc = fs.readFileSync('Estoque.md', 'utf8');

assert.match(
  saleService,
  /import\s+\{\s*stockLocationService\s*\}\s+from\s+['"]\.\/stockLocationService['"]/,
  'saleService must import stockLocationService'
);

assert.match(
  saleService,
  /decrementStockByPriority\s*\(/,
  'PDV stock decrement must call decrementStockByPriority'
);

assert.match(
  saleService,
  /reference_type:\s*['"]sale['"]/,
  'priority decrement must tag movements as sale references'
);

assert.match(
  saleService,
  /reference_id:\s*sale\.id/,
  'priority decrement must link stock movement to the sale id'
);

assert.match(
  saleService,
  /!\(item as any\)\.serialized_unit\?\.unitId/,
  'serialized units must remain excluded from numeric stock decrement'
);

assert.match(
  saleService,
  /supabase\.rpc\(['"]decrement_stock['"]/,
  'legacy decrement_stock fallback must remain while migration may not be deployed'
);

assert.match(
  orderService,
  /decrementOrderItemStockByPriority/,
  'online orders paid/completed must now share the priority decrement path'
);

const createOrderStart = orderService.indexOf('export async function createOrder');
const getOrderStart = orderService.indexOf('export async function getOrderById', createOrderStart);
const createOrderBody = orderService.slice(createOrderStart, getOrderStart);

assert.doesNotMatch(
  createOrderBody,
  /decrementOrderItemStockByPriority|decrementStockByPriority|supabase\.rpc\(['"]decrement_stock['"]/,
  'createOrder must still not reserve or decrement numeric stock'
);

assert.match(
  estoqueDoc,
  /PDV[^.\n]*baixa por prioridade|baixa por prioridade[^.\n]*PDV/i,
  'Estoque.md must document PDV priority decrement status'
);

console.log('sale priority stock decrement static checks passed');
