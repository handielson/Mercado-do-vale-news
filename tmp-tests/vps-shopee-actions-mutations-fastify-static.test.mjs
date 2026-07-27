import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredActions = [
  'ship_order',
  'update_stock',
  'update_price',
];

const requiredEndpoints = [
  '/api/v2/order/get_order_detail',
  '/api/v2/order/get_package_detail',
  '/api/v2/logistics/ship_order',
  '/api/v2/logistics/create_shipping_document',
  '/api/v2/logistics/get_shipping_document_result',
  '/api/v2/product/update_stock',
  '/api/v2/product/update_price',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /async function handleShopeeActionsVps/, `${file} must implement Shopee actions handler`);
  assert.match(source, /function requireShopeeActionsPostVps/, `${file} must guard Shopee actions mutations behind POST`);
  assert.match(source, /function firstShopeeActionsNonEmptyVps/, `${file} must resolve Shopee action fallback values`);
  assert.match(source, /async function loadShopeeActionsProductFromVps/, `${file} must load products before stock and price mutations`);
  assert.match(source, /function getShopeeActionsProductItemIdVps/, `${file} must resolve linked Shopee item ids`);

  for (const action of requiredActions) {
    assert.match(source, new RegExp(`case '${action}'`), `${file} must support Shopee actions mutation ${action}`);
  }

  for (const endpoint of requiredEndpoints) {
    assert.ok(source.includes(endpoint), `${file} must call Shopee endpoint ${endpoint}`);
  }

  assert.match(source, /ship_order_precheck_failed/, `${file} must precheck ship_order before arranging shipment`);
  assert.match(source, /ship_order_not_ready/, `${file} must block ship_order for orders not READY_TO_SHIP`);
  assert.match(source, /ship_order_package_not_ready/, `${file} must block ship_order when package is not ready`);
  assert.match(source, /already_arranged/, `${file} must make repeated ship_order calls idempotent`);
  assert.match(source, /case 'get_shipping_document': \{\s*if \(requireShopeeActionsPostVps/, `${file} must guard shipping document creation behind POST`);
  assert.match(source, /tracking_number:\s*trackingNumber/, `${file} must retrieve a tracking number before creating a shipping document`);
  assert.match(source, /documentStatus === 'READY'/, `${file} must wait for the shipping document to become ready before download`);
  assert.match(source, /POST required/, `${file} must reject GET mutation calls`);
  assert.match(source, /product_id n(?:ÃƒÂ£|Ã£|ã)o fornecido/, `${file} must validate missing product_id`);
  assert.match(source, /Faltam parametros/, `${file} must validate missing stock or price`);
  assert.match(source, /Produto n(?:ÃƒÂ£|Ã£|ã)o vinculado a Shopee/, `${file} must block product mutations without Shopee linkage`);
  assert.match(source, /original_price:\s*Number\(payload\.price\) \/ 100/, `${file} must convert stored cents to Shopee price`);
  assert.match(source, /normal_stock:\s*Number\(payload\.stock\)/, `${file} must send numeric stock`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-actions',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee actions debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in actions debug payloads`);
  }
}

console.log('vps Shopee actions mutation Fastify static checks ok');
