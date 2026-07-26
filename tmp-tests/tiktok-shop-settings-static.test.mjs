import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const service = readFileSync('services/tiktokShopService.ts', 'utf8');
const companySettingsService = readFileSync('services/companySettingsService.ts', 'utf8');
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

assert.doesNotMatch(page, /companySettingsService/, 'TikTokShopPage must use its secret-safe service');
assert.match(page, /tiktokShopService\.getStatus\(\)/, 'TikTokShopPage must load a safe status');
assert.match(service, /\/api\/tiktok-shop\/settings/, 'TikTok service must use the protected settings route');
assert.match(service, /\/api\/tiktok-shop\/shops/, 'TikTok service must expose shop discovery');
assert.doesNotMatch(service, /tiktok_access_token:/, 'Frontend service must not model a raw access token');
assert.doesNotMatch(service, /tiktok_refresh_token:/, 'Frontend service must not model a raw refresh token');
assert.match(companySettingsService, /delete safe\.tiktok_app_secret/, 'Legacy cache must strip app secret');
assert.match(companySettingsService, /delete safe\.tiktok_access_token/, 'Legacy cache must strip access token');
assert.match(companySettingsService, /delete safe\.tiktok_refresh_token/, 'Legacy cache must strip refresh token');
assert.match(companySettingsService, /delete safe\.tiktok_shop_cipher/, 'Legacy cache must strip shop cipher');

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
