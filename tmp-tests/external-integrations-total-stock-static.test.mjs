import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const blingService = read('services/blingService.ts');
const orderService = read('services/orderService.ts');
const shopeeService = read('services/shopeeService.ts');
const productsService = read('services/products.ts');
const vpsServer = read('vps_server.cjs');
const gatewayServer = read('server.js');

assert.match(blingService, /stock_quantity:\s*data\.stock_quantity|stock_quantity:\s*item\.stock_quantity|p\.stock_quantity\s*=\s*stockMap\.get\(p\.id\)/,
  'Bling imports must map total stock to products.stock_quantity');
assert.match(orderService, /syncStockToBling\(/, 'online orders must synchronize stock with Bling');
assert.match(orderService, /comboSelections: item\.combo_selections/, 'combo stock deductions must retain their selected components');

assert.match(vpsServer, /fastify\.patch\('\/products\/stock'[\s\S]*UPDATE products SET stock_quantity=/,
  'VPS must expose a stock update endpoint for Bling webhooks');
assert.match(vpsServer, /fastify\.post\('\/stock-locations\/priority-decrements'/,
  'VPS must keep stock-location deductions as the source of product stock changes');
assert.match(gatewayServer, /patchVpsJsonForWebhookVps\(request, '\/products\/stock'/,
  'the webhook gateway must forward Bling stock updates to the VPS');

assert.match(shopeeService, /action:\s*['"]update_stock['"],\s*product_id:\s*productId,\s*stock:\s*newStock/,
  'Shopee synchronization must send the total product stock');
assert.match(gatewayServer, /stock_list: \[\{ model_id: 0, normal_stock: Number\(payload\.stock\) \}\]/,
  'the Shopee gateway payload must use that total stock');
assert.match(productsService, /shopeeService\.updateStock\(id,\s*input\.stock_quantity\s*\|\|\s*0\)/,
  'product edits must synchronize stock_quantity to Shopee');

console.log('external integrations total stock static checks passed');
