import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredEndpoints = [
  '/api/v2/shop/get_shop_info',
  '/api/v2/order/get_order_list',
  '/api/v2/payment/get_escrow_list',
  '/api/v2/order/get_order_detail',
  '/api/v2/logistics/get_tracking_info',
  '/api/v2/logistics/get_tracking_number',
  '/api/v2/payment/get_escrow_detail',
  '/api/v2/logistics/get_shipping_document_info',
  '/api/v2/logistics/download_shipping_document',
];

const requiredActions = [
  'get_shop_info',
  'get_order_list',
  'get_escrow_list',
  'get_order_detail',
  'get_tracking_info',
  'get_escrow_detail',
  'get_shipping_document',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/shopee-actions', handleShopeeActionsVps\)/, `${file} must expose /api/shopee-actions through Fastify`);
  assert.match(source, /async function handleShopeeActionsVps/, `${file} must implement Shopee actions handler`);
  assert.match(source, /request\.method !== 'POST' && request\.method !== 'GET'/, `${file} must allow only GET and POST for Shopee actions`);
  assert.match(source, /action obrigat(?:Ã³|ó)ria/, `${file} must validate missing action`);
  assert.match(source, /getShopeeCatalogCredentialsVps/, `${file} must reuse VPS Shopee credentials`);
  assert.match(source, /shopeeCatalogGetVps/, `${file} must reuse signed Shopee GET helper`);
  assert.match(source, /shopeeCatalogPostVps/, `${file} must reuse signed Shopee POST helper`);

  for (const action of requiredActions) {
    assert.match(source, new RegExp(`case '${action}'`), `${file} must support Shopee actions read action ${action}`);
  }

  for (const endpoint of requiredEndpoints) {
    assert.ok(source.includes(endpoint), `${file} must call Shopee endpoint ${endpoint}`);
  }

  assert.match(source, /time_from e time_to/, `${file} must validate escrow list date range`);
  assert.match(source, /order_sn_list n(?:Ã£|ã)o fornecido/, `${file} must validate missing order_sn_list`);
  assert.match(source, /order_sn n(?:Ã£|ã)o fornecido/, `${file} must validate missing order_sn`);
  assert.match(source, /attachment; filename="etiqueta-\$\{orderSn\}\.pdf"/, `${file} must preserve PDF label download filename`);
  assert.match(source, /A(?:Ã§|ç)(?:Ã£|ã)o desconhecida/, `${file} must reject unknown actions`);
  assert.match(source, /buildCopyableDebug\('shopee-actions'/, `${file} must include copyable debug for Shopee actions failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-actions',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee actions debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in actions debug payloads`);
  }
}

console.log('vps Shopee actions read-only Fastify static checks ok');
