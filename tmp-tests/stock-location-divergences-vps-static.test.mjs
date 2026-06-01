import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/stockLocationService.ts', 'utf8');
const vpsServer = readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = readFileSync('vps_server.cjs', 'utf8');

const methodBlock = service.match(/async getStockDivergences\(\): Promise<StockLocationDivergence\[]> \{[\s\S]*?\n  \}/);

assert.ok(methodBlock, 'stockLocationService must expose getStockDivergences');
assert.match(
  methodBlock[0],
  /vpsClient\.get<StockLocationDivergence\[]>\('\/stock-locations\/divergences'\)/,
  'getStockDivergences must load divergence rows from the VPS endpoint',
);
assert.doesNotMatch(
  methodBlock[0],
  /supabase\s*[\s\S]*?\.from\(['"]stock_location_divergences['"]\)/,
  'getStockDivergences must not query the Supabase stock_location_divergences view',
);

for (const [name, source] of [
  ['vps_server.js', vpsServer],
  ['vps_server.cjs', vpsServerCjs],
]) {
  assert.match(
    source,
    /fastify\.get\(['"`]\/stock-locations\/divergences['"`],\s*\{\s*preHandler:\s*requireSyncKey\s*\}/,
    `${name} must expose the stock divergence endpoint`,
  );
  assert.match(
    source,
    /FROM products p[\s\S]*LEFT JOIN product_stock_locations psl ON psl\.product_id = p\.id[\s\S]*HAVING difference <> 0[\s\S]*ORDER BY product_name ASC/,
    `${name} must compute non-zero stock divergences in MySQL with a stable product-name order`,
  );
}

console.log('stock location divergences VPS static checks passed');
