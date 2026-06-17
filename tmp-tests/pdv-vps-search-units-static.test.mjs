import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vps = readFileSync('vps_server.js', 'utf8');
const api = readFileSync('services/vpsApiService.ts', 'utf8');
const pdv = readFileSync('services/pdvSerializedInventory.ts', 'utf8');

assert.match(vps, /fastify\.get\('\/pdv\/product-search'/, 'VPS must expose a PDV-specific product search endpoint');
assert.match(vps, /SELECT u\.\*[\s\S]*FROM units u[\s\S]*u\.status = 'available'[\s\S]*u\.product_id IN/, 'PDV search endpoint must hydrate only available serialized units');
assert.match(
  vps,
  /matchingUnitProductIds[\s\S]*FROM units u[\s\S]*u\.status = 'available'[\s\S]*LOWER\(TRIM\(u\.serial\)\)/,
  'PDV product search must also search available unit identifiers so a typed serial can find its product card',
);
assert.match(api, /async searchPdvProducts/, 'vpsApiService must expose searchPdvProducts');
assert.match(pdv, /fromHydratedPdvSearchPayload/, 'pdvSerializedInventory must normalize hydrated VPS payloads into product cards');

console.log('pdv VPS search units static checks passed');
