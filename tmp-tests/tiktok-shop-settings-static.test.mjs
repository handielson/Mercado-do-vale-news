import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const vpsServer = readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = readFileSync('vps_server.cjs', 'utf8');
const server = readFileSync('server.js', 'utf8');
const types = readFileSync('types/companySettings.ts', 'utf8');

assert.doesNotMatch(
  page,
  /\.from\(['"]company_settings['"]\)/,
  'TikTokShopPage must not read company_settings through Supabase',
);

assert.match(
  page,
  /companySettingsService\.get\(\)/,
  'TikTokShopPage must load company settings through the shared VPS service',
);

assert.match(routes, /TikTokShopPage/, 'TikTok Shop page must be lazy-loaded in routes');
assert.match(routes, /\/admin\/settings\/tiktok-shop/, 'TikTok Shop route must be registered');
assert.match(layout, /TikTok Shop/, 'TikTok Shop must be visible in admin navigation');

for (const source of [vpsServer, vpsServerCjs, server]) {
  for (const field of [
    'tiktok_app_key',
    'tiktok_app_secret',
    'tiktok_service_id',
    'tiktok_shop_cipher',
    'tiktok_access_token',
    'tiktok_refresh_token',
    'tiktok_open_id',
    'tiktok_seller_name',
    'tiktok_seller_base_region',
    'tiktok_granted_scopes',
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`), `${field} must be present in server fields/migrations`);
  }
}

assert.match(types, /tiktok_app_key\?: string \| null;/, 'CompanySettingsInput must type TikTok app key');
assert.match(types, /tiktok_refresh_token_expires_at\?: string \| null;/, 'CompanySettingsInput must type TikTok refresh expiry');

console.log('TikTok Shop settings static checks ok');
