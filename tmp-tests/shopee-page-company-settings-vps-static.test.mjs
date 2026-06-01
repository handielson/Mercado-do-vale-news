import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /\.from\(['"]company_settings['"]\)/,
  'ShopeePage must not read company_settings through Supabase',
);

assert.match(
  source,
  /const data = await getCompanyData\(\);/,
  'ShopeePage must load company data through the shared VPS company service',
);

assert.match(
  source,
  /setShopeeConnected\(!!data\.shopee_access_token\)/,
  'ShopeePage must derive Shopee connection state from VPS company data',
);

assert.match(
  source,
  /setShopeeShopId\(data\.shopee_shop_id \|\| null\)/,
  'ShopeePage must derive Shopee shop id from VPS company data',
);

console.log('ShopeePage company settings VPS static checks ok');
