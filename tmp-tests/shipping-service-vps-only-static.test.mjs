import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shippingService = readFileSync('services/shippingService.ts', 'utf8');
const vpsApiService = readFileSync('services/vpsApiService.ts', 'utf8');

assert.doesNotMatch(
  shippingService,
  /from ['"]\.\/supabase['"]/,
  'shippingService must not import Supabase for shipping config CRUD',
);

for (const table of ['shipping_settings', 'shipping_zones', 'shipping_price_ranges']) {
  assert.doesNotMatch(
    shippingService,
    new RegExp(`\\.from\\(['"]${table}['"]\\)`),
    `shippingService must not read/write ${table} through Supabase`,
  );
}

for (const method of [
  'getShippingSettings',
  'syncShippingSettings',
  'getShippingZones',
  'createShippingZone',
  'updateShippingZone',
  'deleteShippingZone',
  'getShippingPriceRanges',
  'createShippingPriceRange',
  'updateShippingPriceRange',
  'deleteShippingPriceRange',
]) {
  assert.match(
    vpsApiService,
    new RegExp(`async\\s+${method}\\s*\\(`),
    `vpsApiService must expose ${method} for VPS-backed shipping config`,
  );
  assert.match(
    shippingService,
    new RegExp(`vpsApiService\\.${method}\\s*\\(`),
    `shippingService must call vpsApiService.${method}()`,
  );
}

console.log('shippingService VPS-only static checks ok');
