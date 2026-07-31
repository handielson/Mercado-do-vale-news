import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vps = readFileSync('vps_server.js', 'utf8');
const api = readFileSync('services/vpsApiService.ts', 'utf8');
const pdv = readFileSync('services/pdvSerializedInventory.ts', 'utf8');

assert.match(vps, /fastify\.get\('\/pdv\/product-search'/, 'VPS must expose a PDV-specific product search endpoint');
assert.match(vps, /productsWithUnitHistory = new Set\(\)/, 'PDV search must distinguish products that already have unit history');
assert.match(vps, /if \(unit\.status !== 'available'\) continue/, 'PDV search must expose only available units while retaining sold-unit history');
assert.match(vps, /has_unit_history: productsWithUnitHistory\.has\(product\.id\)/, 'PDV payload must prevent stale product specs from reviving sold identifiers');
assert.match(
  vps,
  /SELECT DISTINCT u\.product_id[\s\S]*FROM units u[\s\S]*u\.status = 'available'[\s\S]*LOWER\(TRIM\(u\.serial\)\)/,
  'PDV product search must also search available unit identifiers so a typed serial can find its product card',
);
assert.match(
  vps,
  /JSON_UNQUOTE\(JSON_EXTRACT\(specs, '\$\.serial'\)\)[\s\S]*LIKE \?/,
  'PDV product search must find legacy serialized products whose serial is still stored in products.specs.serial',
);
assert.match(api, /async searchPdvProducts/, 'vpsApiService must expose searchPdvProducts');
assert.match(pdv, /fromHydratedPdvSearchPayload/, 'pdvSerializedInventory must normalize hydrated VPS payloads into product cards');

console.log('pdv VPS search units static checks passed');
