import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const stock = readFileSync('services/externalStockReconciliation.cjs', 'utf8');

assert.ok(
  server.includes('async function ensureIncomingStockLocation'),
  'VPS must create an incoming/conference stock location for externally received stock'
);
assert.ok(server.includes("'DEPOSITO'"), 'incoming stock must live under the Deposito warehouse');
assert.ok(server.includes("'ENTRADA-CONFERENCIA'"), 'incoming stock must use Entrada-Conferencia as the location code');
assert.ok(server.includes("'Entrada / Conferencia'"), 'incoming stock must use a clear Entrada / Conferencia label');

const reconcileStart = server.indexOf('async function reconcileProductStockLocationsToTotal');
const reconcileEnd = server.indexOf('async function getStockLocationRow', reconcileStart);
assert.ok(reconcileStart > -1 && reconcileEnd > reconcileStart, 'reconcile function must exist before stock row helpers');
const reconcileBody = server.slice(reconcileStart, reconcileEnd);
assert.match(reconcileBody, /getIncoming: ensureIncomingStockLocation/,
  'the wrapper must inject Entrada / Conferencia into the shared reconciler');
assert.match(stock, /if\(target>currentTotal\|\|resetToIncoming\)\s*\{\s*const incoming=await getIncoming\(companyId\)/,
  'positive deltas must use the injected incoming location');
assert.match(stock, /materializeUndistributed&&target<=currentTotal/,
  'materialization must skip balances already distributed');
assert.match(stock, /SELECT id,company_id,stock_quantity FROM products.*FOR UPDATE/,
  'materialization must read its source balance under the product lock');

assert.ok(
  server.includes('async function materializeProductUndistributedStock'),
  'VPS must materialize existing product stock that has no location'
);
assert.ok(
  server.includes('async function resetProductStockLocationsToIncoming'),
  'VPS must reset zero-stock reentries into the incoming/conference location'
);
assert.ok(
  server.includes("'external_stock_reentry'"),
  'zero-stock reentry movements must have an explicit audit reference type'
);
assert.ok(
  server.includes('previousStock <= 0 && qty > 0'),
  'Bling stock updates must detect a product reentering stock from zero'
);
assert.ok(
  server.includes('resetProductStockLocationsToIncoming(row.id, qty'),
  'Bling stock reentries must reconcile through Entrada / Conferencia while preserving reservations'
);
assert.ok(
  stock.includes("INSERT INTO stock_location_movements"),
  'materialized stock must write a movement history row'
);
assert.ok(
  stock.includes("'undistributed_stock'"),
  'materialized stock movement must be tagged as undistributed_stock'
);

const distributionRoute = server.slice(
  server.indexOf("fastify.get('/stock-locations/products/:productId/distribution'"),
  server.indexOf("fastify.get('/stock-locations/locations/:locationId/contents'")
);
assert.ok(
  /await\s+materializeProductUndistributedStock\(\s*req\.params\.productId/.test(distributionRoute),
  'distribution reads must first materialize any stock that exists only in products.stock_quantity'
);

console.log('stock location incoming conference static checks passed');
