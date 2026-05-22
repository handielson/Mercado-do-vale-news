import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredEndpoints = [
  '/api/v2/product/add_item',
  '/api/v2/product/update_price',
  '/api/v2/product/update_stock',
  '/api/v2/product/update_model',
  '/api/v2/product/init_tier_variation',
  '/api/v2/product/delete_item',
  '/api/v2/product/update_item_status',
  '/api/v2/product/update_item',
];

const requiredActions = [
  'add_item',
  'update_price',
  'update_stock',
  'update_model',
  'init_tier_variation',
  'delete_item',
  'update_item_status',
  'update_item',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /async function handleShopeeCatalogVps/, `${file} must implement Shopee catalog handler`);
  assert.match(source, /function requireShopeeCatalogPostVps/, `${file} must guard catalog mutations behind POST`);
  assert.match(source, /function normalizeShopeeCatalogPricePayloadVps/, `${file} must normalize update_price payloads`);
  assert.match(source, /function mergeShopeeCatalogUpdateItemPayloadVps/, `${file} must preserve required item fields during update_item`);

  for (const action of requiredActions) {
    assert.match(source, new RegExp(`case '${action}'`), `${file} must support Shopee catalog mutation ${action}`);
  }

  for (const endpoint of requiredEndpoints) {
    assert.ok(source.includes(endpoint), `${file} must call Shopee endpoint ${endpoint}`);
  }

  assert.match(source, /POST required/, `${file} must reject non-POST mutation calls`);
  assert.match(source, /price_list required/, `${file} must validate missing price_list`);
  assert.match(source, /item_id required/, `${file} must validate missing item_id`);
  assert.match(source, /get_item_base_info[\s\S]*need_tax_info:\s*true/, `${file} must fetch current item tax info before update_item`);
  assert.match(source, /get_model_list[\s\S]*update_model/, `${file} must update variation GTINs before update_item when needed`);
  assert.match(source, /buildCopyableDebug\('shopee-catalog'/, `${file} must keep copyable debug for catalog failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-catalog',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in catalog debug payloads`);
  }
}

console.log('vps Shopee catalog mutation Fastify static checks ok');
