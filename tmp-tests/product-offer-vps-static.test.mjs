import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');
const service = readFileSync('services/vpsApiService.ts', 'utf8');

for (const source of [server, serverCjs]) {
  assert.match(source, /offer_type/);
  assert.match(source, /offer_parent_product_id/);
  assert.match(source, /fastify\.get\('\/offers'/);
  assert.match(source, /fastify\.post\('\/offers'/);
  assert.match(source, /fastify\.put\('\/offers\/:id'/);
}

assert.match(service, /async getOffers/);
assert.match(service, /async createOffer/);
assert.match(service, /async updateOffer/);

console.log('product offer VPS static checks passed');
