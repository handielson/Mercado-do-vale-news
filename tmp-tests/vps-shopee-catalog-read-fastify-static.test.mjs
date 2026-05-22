import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredEndpoints = [
  '/api/v2/product/get_category',
  '/api/v2/product/get_attribute_tree',
  '/api/v2/product/search_attribute_value_list',
  '/api/v2/product/get_brand_list',
  '/api/v2/shop/get_shop_info',
  '/api/v2/logistics/get_channel_list',
  '/api/v2/inventory/get_warehouse_list',
  '/api/v2/shop/get_warehouse_detail',
  '/api/v2/merchant/get_merchant_warehouse_location_list',
  '/api/v2/product/get_item_list',
  '/api/v2/product/get_item_base_info',
  '/api/v2/product/get_model_list',
];

const requiredActions = [
  'categories',
  'attributes',
  'search_attribute_values',
  'brand_list',
  'shop_info',
  'logistics_channel_list',
  'warehouse_list',
  'warehouse_detail',
  'warehouse_locations',
  'get_item_list',
  'get_item_base_info',
  'get_model_list',
  'debug',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/shopee-catalog', handleShopeeCatalogVps\)/, `${file} must expose /api/shopee-catalog through Fastify`);
  assert.match(source, /async function handleShopeeCatalogVps/, `${file} must implement Shopee catalog handler`);
  assert.match(source, /async function getShopeeCatalogCredentialsVps/, `${file} must load Shopee catalog credentials`);
  assert.match(source, /select=shopee_partner_id,shopee_partner_key,shopee_access_token,shopee_shop_id,shopee_refresh_token&limit=1/, `${file} must load Shopee catalog tokens from company_settings`);
  assert.match(source, /Shopee n(?:Ã£|ã)o autenticada\. Configure as credenciais no painel\./, `${file} must preserve missing authentication message`);
  assert.match(source, /function generateShopeeShopSignVps/, `${file} must generate Shopee shop-level signatures`);
  assert.match(source, /`\$\{partnerId\}\$\{apiPath\}\$\{timestamp\}\$\{accessToken\}\$\{shopId\}`/, `${file} must sign shop requests with access token and shop id`);
  assert.match(source, /invalid_access_token[\s\S]*invalid_acceess_token[\s\S]*error_auth/, `${file} must detect retryable Shopee auth errors`);
  assert.match(source, /async function refreshShopeeCatalogTokenVps/, `${file} must refresh expired Shopee access tokens`);
  assert.match(source, /shopee_access_token: tokenData\.access_token/, `${file} must persist refreshed Shopee access token`);
  assert.match(source, /shopee_refresh_token: tokenData\.refresh_token/, `${file} must persist refreshed Shopee refresh token`);

  for (const action of requiredActions) {
    assert.match(source, new RegExp(`action === '${action}'|case '${action}'`), `${file} must support Shopee catalog action ${action}`);
  }

  for (const endpoint of requiredEndpoints) {
    assert.ok(source.includes(endpoint), `${file} must call Shopee endpoint ${endpoint}`);
  }

  assert.match(source, /category_id required/, `${file} must validate missing category_id`);
  assert.match(source, /attribute_id required/, `${file} must validate missing attribute_id`);
  assert.match(source, /item_id_list required/, `${file} must validate missing item_id_list`);
  assert.match(source, /item_id required/, `${file} must validate missing item_id`);
  assert.match(source, /Unknown action: \$\{action\}/, `${file} must reject unknown catalog actions`);
  assert.match(source, /buildCopyableDebug\('shopee-catalog'/, `${file} must include copyable debug for catalog failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-catalog',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee catalog debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in catalog debug payloads`);
  }
}

console.log('vps Shopee catalog read-only Fastify static checks ok');
