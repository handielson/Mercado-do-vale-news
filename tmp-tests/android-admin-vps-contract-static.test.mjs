import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const mirrors = fs.readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');

assert.equal(source, mirrors, 'vps_server.js e vps_server.cjs devem permanecer identicos');

for (const route of [
  '/stock-locations/deposits',
  '/stock-locations/locations',
  '/stock-locations/products/:productId/distribution',
  '/stock-locations/locations/:locationId/contents',
]) {
  assert.match(source, new RegExp(`fastify\\.get\\('${route.replace(/[/:]/g, '\\$&')}', \\{ preHandler: requireSyncKeyOrAdmin \\}`));
}

assert.match(source, /fastify\.post\('\/stock-locations\/transfers', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(source, /const LABEL_TEMPLATES_PREFERENCE_KEY = 'label\.templates';/);
assert.match(source, /fastify\.get\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(source, /fastify\.patch\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);

console.log('android admin VPS contract: OK');
