import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/vpsApiService.ts', 'utf8');
const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  service,
  /preferProxy\?:\s*boolean;\s*proxyOnly\?:\s*boolean/,
  'vpsApiService.getProducts must accept preferProxy/proxyOnly for admin screens that should not wait for the direct VPS attempt.'
);

assert.match(
  service,
  /private async fetchSafe<[\s\S]*options:\s*\{\s*preferProxy\?:\s*boolean;\s*proxyOnly\?:\s*boolean\s*\}/,
  'fetchSafe must accept preferProxy and proxyOnly options.'
);

assert.match(
  service,
  /const urls\s*=\s*proxyOnly\s*\?\s*\[fallbackUrl\][\s\S]*preferProxy[\s\S]*fallbackUrl[\s\S]*primaryUrl/,
  'fetchSafe must support proxy-only product loads and try the forced proxy before the direct URL when preferProxy is true.'
);

assert.match(
  page,
  /fetchAllVpsProducts\(\{\s*status:\s*'all',\s*noCache:\s*true,\s*preferProxy:\s*true,\s*proxyOnly:\s*true\s*\}\)/,
  'Shopee bulk/product loading must use only the proxy to avoid the 15s direct VPS timeout fallback.'
);

assert.match(
  page,
  /fetchAllVpsProducts\(\{\s*noCache:\s*true,\s*preferProxy:\s*true,\s*proxyOnly:\s*true\s*\}\)/,
  'Shopee import matching must also use only the proxy for full catalog downloads.'
);

assert.match(
  page,
  /const pageSize\s*=\s*500;/,
  'Shopee full product pagination must keep page size below the slow 2000-row response.'
);

console.log('shopee bulk products prefer proxy static checks passed');
