import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  const routeStart = source.indexOf("fastify.patch('/products/stock'");
  const routeEnd = source.indexOf("fastify.patch('/products/name'", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, `${file} must expose the stock update route`);
  const route = source.slice(routeStart, routeEnd);

  assert.match(
    source,
    /async function reconcileProductStockLocationsToTotal\(/,
    `${file} must reconcile location balances when an external total stock update arrives`
  );
  assert.match(
    route,
    /await reconcileProductStockLocationsToTotal\(row\.id,\s*qty,/,
    `${file} /products/stock must distribute Bling total changes into stock locations`
  );
  assert.match(
    source,
    /reference_type,\s*previous_to_quantity,\s*new_to_quantity,\s*notes\)[\s\S]*'sync', \?, \?/,
    `${file} must record sync movements when stock is added to a default location`
  );
}

console.log('stock location Bling total distribution static checks passed');
