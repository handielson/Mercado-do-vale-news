import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogService = readFileSync('services/catalogService.ts', 'utf8');
const vpsServer = readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = readFileSync('vps_server.cjs', 'utf8');

const recordBlock = catalogService.match(/recordProductView: async[\s\S]*?\n    \},/);

assert.ok(recordBlock, 'catalogService must expose recordProductView');
assert.match(
  recordBlock[0],
  /vpsClient\.post\(['"`]\/products\/\$\{encodeURIComponent\(productId\)\}\/view['"`],/,
  'recordProductView must post product view telemetry to the VPS product view endpoint',
);
assert.doesNotMatch(
  recordBlock[0],
  /supabase\.from\(['"]product_views['"]\)|supabase\.rpc\(['"]increment_product_views['"]\)/,
  'recordProductView must not write product_views or increment counters through Supabase',
);

for (const [name, source] of [
  ['vps_server.js', vpsServer],
  ['vps_server.cjs', vpsServerCjs],
]) {
  assert.match(
    source,
    /fastify\.post\(['"`]\/products\/:id\/view['"`],\s*\{\s*preHandler:\s*requireSyncKey\s*\}/,
    `${name} must expose the VPS product view endpoint`,
  );
  assert.match(
    source,
    /INSERT INTO product_views[\s\S]*product_id[\s\S]*customer_id[\s\S]*session_id/,
    `${name} must persist product view rows in MySQL`,
  );
  assert.match(
    source,
    /UPDATE products\s+SET view_count=COALESCE\(view_count,0\)\+1,\s*updated_at=CURRENT_TIMESTAMP\s+WHERE id=\?/,
    `${name} must increment products.view_count without Supabase RPC`,
  );
}

console.log('catalog product views VPS static checks passed');
