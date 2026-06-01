import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.js', 'utf8');
const routeStart = source.indexOf("fastify.patch('/company-settings'");
assert.notEqual(routeStart, -1, 'company-settings PATCH route must exist');

const route = source.slice(routeStart, source.indexOf("fastify.get('/versions'", routeStart));

for (const field of [
  'bling_client_id',
  'bling_client_secret',
  'bling_callback_url',
  'bling_access_token',
  'bling_refresh_token',
  'bling_token_expires_at',
]) {
  assert.match(route, new RegExp(`['"]${field}['"]`), `company-settings PATCH must allow ${field}`);
}

console.log('company-settings Bling PATCH static checks ok');
