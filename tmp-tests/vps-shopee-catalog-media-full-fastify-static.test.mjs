import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredActions = [
  'upload_image',
  'upload_video',
  'get_full_catalog',
];

const requiredEndpoints = [
  '/api/v2/media_space/upload_image',
  '/api/v2/media_space/init_video_upload',
  '/api/v2/media_space/upload_video_part',
  '/api/v2/media_space/complete_video_upload',
  '/api/v2/media_space/get_video_upload_result',
  '/api/v2/product/get_item_list',
  '/api/v2/product/get_item_base_info',
];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /async function handleShopeeCatalogVps/, `${file} must implement Shopee catalog handler`);
  assert.match(source, /async function resolveShopeeCatalogMediaInputVps/, `${file} must resolve Shopee catalog media inputs`);
  assert.match(source, /function md5ShopeeCatalogHexVps/, `${file} must calculate MD5 for Shopee video chunks`);
  assert.match(source, /function getShopeeCatalogVideoUploadIdVps/, `${file} must resolve video_upload_id variants`);
  assert.match(source, /function getShopeeCatalogVideoUploadStatusVps/, `${file} must normalize video upload status`);
  assert.match(source, /async function shopeeCatalogMultipartVps/, `${file} must support multipart upload helper`);

  for (const action of requiredActions) {
    assert.match(source, new RegExp(`case '${action}'`), `${file} must support Shopee catalog action ${action}`);
  }

  for (const endpoint of requiredEndpoints) {
    assert.ok(source.includes(endpoint), `${file} must call Shopee endpoint ${endpoint}`);
  }

  assert.match(source, /invalid image_data_url/, `${file} must validate image upload input`);
  assert.match(source, /invalid video input/, `${file} must validate video upload input`);
  assert.match(source, /video_upload_id_not_found/, `${file} must handle missing Shopee video upload id`);
  assert.match(source, /video_upload_timeout/, `${file} must return timeout while Shopee processes video`);
  assert.match(source, /safety < 200/, `${file} must cap full catalog pagination`);
  assert.match(source, /maxPages/, `${file} must support bounded full catalog validation by max_pages`);
  assert.match(source, /maxItems/, `${file} must support bounded full catalog validation by max_items`);
  assert.match(source, /detailBatch = 50/, `${file} must fetch full catalog details in batches`);
  assert.match(source, /POST required/, `${file} must reject non-POST media upload calls`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-catalog',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in catalog debug payloads`);
  }
}

console.log('vps Shopee catalog media/full Fastify static checks ok');
