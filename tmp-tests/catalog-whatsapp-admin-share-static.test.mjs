import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frontend = readFileSync('components/catalog/ShareCatalogButton.tsx', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');
const route = server.match(/fastify\.post\('\/admin\/catalog\/whatsapp-share'[\s\S]*?\n\}\);/);

assert.match(frontend, /customer\?\.customer_type === 'ADMIN'/);
assert.match(frontend, /sendCatalogSharePart\(/);
assert.match(frontend, /splitCatalogMessageForWhatsApp\(await generateSelectedMessage\(\)\)/);
assert.ok(route, 'The admin catalog share route must exist');
assert.match(route[0], /preHandler: requireAdminBearerToken/);
assert.match(route[0], /productCount > 3/);
assert.match(route[0], /sourceNode: 'admin-catalog-share'/);
assert.doesNotMatch(route[0], /upsertN8nBotClientControl/, 'A catalog share must not pause the client bot');
console.log('admin catalog WhatsApp sharing contract: ok');
