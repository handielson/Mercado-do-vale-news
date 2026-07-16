import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');

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
const positiveDeltaStart = reconcileBody.indexOf('if (delta > 0)');
const negativeDeltaStart = reconcileBody.indexOf('} else {', positiveDeltaStart);
assert.ok(positiveDeltaStart > -1 && negativeDeltaStart > positiveDeltaStart, 'reconcile must have a positive delta branch');
const positiveDeltaBody = reconcileBody.slice(positiveDeltaStart, negativeDeltaStart);
assert.ok(
  positiveDeltaBody.includes('ensureIncomingStockLocation(companyId)'),
  'positive external stock deltas must be assigned to Entrada / Conferencia'
);
assert.ok(
  !positiveDeltaBody.includes('ensureDefaultStockLocation(companyId)'),
  'positive external stock deltas must not be assigned to Loja Principal / Estoque Geral'
);

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
  'Bling stock reentries must recreate the whole balance in Entrada / Conferencia'
);
assert.ok(
  server.includes("reference_type, previous_to_quantity, new_to_quantity, notes)"),
  'materialized stock must write a movement history row'
);
assert.ok(
  server.includes("'undistributed_stock'"),
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
