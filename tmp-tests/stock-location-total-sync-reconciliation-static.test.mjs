import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverFiles = ['vps_server.cjs', 'vps_server.js'];

for (const file of serverFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');

  assert.match(
    source,
    /fastify\.patch\('\/products\/prices-stock'[\s\S]*const locationSync = \[][\s\S]*reconcileProductStockLocationsToTotal\([\s\S]*'prices_stock_update'[\s\S]*results\.locationSync = locationSync[\s\S]*return results;/,
    `${file} must reconcile product-location balances when /products/prices-stock changes stock_quantity`
  );

  assert.match(
    source,
    /fastify\.put\('\/products\/:id'[\s\S]*reconcileProductStockLocationsToTotal\([\s\S]*'product_update'[\s\S]*return \{ ok: true, locationSync \};/,
    `${file} must reconcile product-location balances when a product edit changes the stock total`
  );
}

console.log('stock location total sync reconciliation static checks passed');
