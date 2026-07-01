import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/vpsApiService.ts', 'utf8');
const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  service,
  /preferProxy\?:\s*boolean/,
  'vpsApiService.getProducts must accept preferProxy for admin screens that should not wait for the direct VPS attempt.'
);

assert.match(
  service,
  /private async fetchSafe<[\s\S]*options:\s*\{\s*preferProxy\?:\s*boolean\s*\}/,
  'fetchSafe must accept a preferProxy option.'
);

assert.match(
  service,
  /const urls\s*=\s*preferProxy[\s\S]*fallbackUrl[\s\S]*primaryUrl/,
  'fetchSafe must try the forced proxy before the direct URL when preferProxy is true.'
);

assert.match(
  page,
  /fetchAllVpsProducts\(\{\s*status:\s*'all',\s*noCache:\s*true,\s*preferProxy:\s*true\s*\}\)/,
  'Shopee bulk/product loading must prefer the proxy to avoid the 15s direct VPS timeout.'
);

assert.match(
  page,
  /fetchAllVpsProducts\(\{\s*noCache:\s*true,\s*preferProxy:\s*true\s*\}\)/,
  'Shopee import matching must also prefer the proxy for full catalog downloads.'
);

console.log('shopee bulk products prefer proxy static checks passed');
