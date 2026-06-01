import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const service = readFileSync('services/stockLocationService.ts', 'utf8');

for (const table of [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
]) {
  assert.match(server, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `VPS must create ${table}`);
}

for (const endpoint of [
  "fastify.get('/stock-locations/deposits'",
  "fastify.post('/stock-locations/deposits'",
  "fastify.patch('/stock-locations/deposits/:id'",
  "fastify.get('/stock-locations/locations'",
  "fastify.post('/stock-locations/locations'",
  "fastify.patch('/stock-locations/locations/:id'",
  "fastify.get('/stock-locations/products/:productId/distribution'",
  "fastify.get('/stock-locations/locations/:locationId/contents'",
  "fastify.get('/stock-locations/movements'",
  "fastify.post('/stock-locations/adjustments'",
  "fastify.post('/stock-locations/entries'",
  "fastify.post('/stock-locations/transfers'",
  "fastify.post('/stock-locations/priority-decrements'",
  "fastify.post('/stock-locations/priority-reservations'",
  "fastify.post('/stock-locations/order-reservations/consume'",
  "fastify.post('/stock-locations/order-reservations/release'",
  "fastify.post('/stock-locations/sale-restores'",
  "fastify.post('/stock-locations/order-restores'",
  "fastify.post('/admin/stock-locations/import'",
]) {
  assert.ok(server.includes(endpoint), `VPS must expose ${endpoint}`);
}

assert.ok(server.includes('seedDefaultStockLocations'), 'VPS migration must seed Loja Principal / Estoque Geral');
assert.ok(server.includes('backfillProductStockLocations'), 'VPS migration must backfill current product stock into locations');
assert.ok(server.includes('syncProductStockFromLocations'), 'VPS must recalculate product stock from location balances');
assert.ok(server.includes('replaceStockLocationTablesFromImport'), 'VPS must support replacing stock location tables from a canonical migration import');
assert.ok(server.includes("dropIndexIfExists('stock_locations', 'uniq_stock_locations_deposit_code')"), 'VPS must remove the unique stock location code constraint to preserve legacy duplicate location codes');
assert.ok(!server.includes('UNIQUE KEY uniq_stock_locations_deposit_code'), 'new VPS schemas must not enforce unique location codes per deposit');

assert.ok(service.includes("vpsClient.get<StockDeposit[]>('/stock-locations/deposits')"), 'front service must read deposits from VPS');
assert.ok(service.includes("vpsClient.get<StockLocation[]>(`/stock-locations/locations${query}`)"), 'front service must read locations from VPS');
assert.ok(service.includes("vpsClient.post<StockDeposit>('/stock-locations/deposits'"), 'front service must create deposits on VPS');
assert.ok(service.includes("vpsClient.post<ProductStockLocation>('/stock-locations/entries'"), 'front service must add stock on VPS');
assert.ok(service.includes("'/stock-locations/priority-decrements'"), 'front service must decrement priority stock on VPS');
assert.ok(service.includes("'/stock-locations/priority-reservations'"), 'front service must reserve priority stock on VPS');
assert.ok(service.includes("'/stock-locations/order-reservations/consume'"), 'front service must consume order reservations on VPS');
assert.ok(service.includes("'/stock-locations/order-restores'"), 'front service must restore order stock on VPS');
assert.ok(!service.includes('supabase.rpc'), 'front service must not call Supabase stock RPCs');
assert.ok(!service.includes(".from('stock_deposits')"), 'front service must not read/write stock_deposits through Supabase');
assert.ok(!service.includes(".from('product_stock_locations')"), 'front service must not read/write product_stock_locations through Supabase');

console.log('vps stock location contract static checks passed');
