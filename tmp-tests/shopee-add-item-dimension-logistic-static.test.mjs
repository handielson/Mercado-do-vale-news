import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  source,
  /const packageDimension = \{\s*package_length: Math\.max\(1, Math\.round\(packageLength \|\| 20\)\),\s*package_width: Math\.max\(1, Math\.round\(packageWidth \|\| 15\)\),\s*package_height: Math\.max\(1, Math\.round\(packageHeight \|\| 10\)\),\s*\};/s,
  'Shopee add_item payload must build mandatory package dimension with safe fallbacks'
);

assert.match(
  source,
  /const logisticInfo = await collectShopeeLogisticInfo\(\);[\s\S]*logistic_info: logisticInfo/,
  'Shopee add_item payload must use logistic_info singular, not logistics_info'
);

assert.match(
  source,
  /getShopeeDebug\('logistics_channel_list', 'logistics_context:channel_list'\)/,
  'Shopee add_item must discover enabled logistics channels from Shopee before publishing'
);

assert.match(
  source,
  /enabled_channel_count: logisticInfo\.length/,
  'Shopee add_item must log how many enabled logistics channels were found'
);

const apiSource = fs.readFileSync('api/shopee-catalog.ts', 'utf8');
assert.match(
  apiSource,
  /action === 'logistics_channel_list'[\s\S]*\/api\/v2\/logistics\/get_channel_list/,
  'Shopee catalog proxy must expose logistics/get_channel_list'
);

assert.match(
  source,
  /dimension: packageDimension/,
  'Shopee add_item payload must include dimension'
);

assert.match(
  source,
  /setBlingPhysicalDefaults\(\{\s*weightKg: resolved\.weightKg,\s*dimensions: resolved\.dimensions,\s*\}\)/,
  'Shopee modal must keep physical dimensions loaded from Bling detail'
);

assert.match(
  source,
  /blingDimensions\?\.depth_cm[\s\S]*blingDimensions\?\.width_cm[\s\S]*blingDimensions\?\.height_cm/,
  'Shopee package dimensions must use Bling dimensions before falling back to safe defaults'
);

assert.match(
  source,
  /const \[gtinMode, setGtinMode\] = useState<'code' \| 'no_gtin'>\(initialGtinMode\);/,
  'Shopee add_item modal must let the seller choose GTIN mode'
);

assert.match(
  source,
  /<option value="no_gtin">Produto sem GTIN<\/option>/,
  'Shopee add_item modal must offer a no-GTIN option'
);

assert.match(
  source,
  /tax_info: \{ gtin: gtinPayloadValue \},\s*gtin_code: gtinPayloadValue,/,
  'Shopee add_item payload must send GTIN through tax_info and gtin_code'
);

assert.match(
  source,
  /gtinPayloadValue = gtinMode === 'no_gtin'\s*\? 'SEM GTIN'\s*: cleanGtin;/,
  'Shopee add_item payload must send SEM GTIN when no-GTIN mode is selected'
);

assert.match(
  source,
  /item_sku: cleanItemSku \|\| undefined/,
  'Shopee add_item payload must send the local product SKU as item_sku'
);

assert.match(
  source,
  /const brandInfo = await collectShopeeBrandInfo\(\);[\s\S]*brand: brandInfo/,
  'Shopee add_item payload must use a mapped Shopee brand when available'
);

assert.match(
  source,
  /function inferShopeeBrandName/,
  'Shopee sync must infer marketplace brand when the local brand is generic'
);

assert.match(
  source,
  /brand_name:\s*inferredBrandName/,
  'Shopee brand list search must use the inferred marketplace brand'
);

assert.match(
  source,
  /findShopeeBrandOption\(nextBrandOptions,\s*inferredBrandName\)/,
  'Shopee brand selection must match the inferred marketplace brand against the official brand list'
);

assert.match(
  apiSource,
  /action === 'brand_list'[\s\S]*\/api\/v2\/product\/get_brand_list/,
  'Shopee catalog proxy must expose product/get_brand_list'
);

assert.match(
  apiSource,
  /if \(brandName\) params\.set\('brand_name', brandName\);/,
  'Shopee brand list proxy must pass brand_name to Shopee so searchable brands like Xiaomi are returned'
);

assert.match(
  apiSource,
  /firstString\(data\?\.response\?\.next_offset,\s*data\?\.response\?\.next\)/,
  'Shopee brand list proxy must follow Shopee next_offset cursor instead of numeric pagination'
);

assert.match(
  source,
  /video\.video_url \? \{ video_url: video\.video_url \} : \{ video_data_url: resolvedVideoDataUrl \}/,
  'Shopee add_item must send remote videos as video_url so the backend downloads and uploads them'
);

assert.match(
  source,
  /video_upload_id:\s*videoUploadIdList/,
  'Shopee add_item must send uploaded videos through video_upload_id, as expected by the product API'
);

assert.match(
  source,
  /expectedVideoCandidateCount = availableVideos\.filter/,
  'Shopee sync must treat any visible modal video as an expected video, even before upload ids exist'
);

assert.match(
  source,
  /expectedVideoCandidateCount > 0 && !videoAlreadyPresentOnShopee && savedVideoCount === 0/,
  'Shopee sync must keep debug open when a visible modal video is not saved by Shopee'
);

assert.match(
  source,
  /video_upload_id:\s*videoUploadIdList[\s\S]*post_publish:attach_video/,
  'Shopee sync must try to attach uploaded videos after publish if add_item did not persist them'
);

assert.doesNotMatch(
  source,
  /video_info:\s*\{\s*video_id_list:\s*videoIdList\s*\}/,
  'Shopee add_item must not send uploaded videos as video_info.video_id_list'
);

assert.match(
  apiSource,
  /typeof v === 'number' && Number\.isFinite\(v\)/,
  'Shopee video upload must accept numeric video_id/video_upload_id responses'
);

assert.match(
  apiSource,
  /'\/api\/v2\/media_space\/init_video_upload'/,
  'Shopee video upload must start with media_space/init_video_upload'
);

assert.match(
  apiSource,
  /'\/api\/v2\/media_space\/upload_video_part'/,
  'Shopee video upload must send video bytes with media_space/upload_video_part'
);

assert.match(
  apiSource,
  /'\/api\/v2\/media_space\/complete_video_upload'/,
  'Shopee video upload must complete with media_space/complete_video_upload'
);

assert.match(
  apiSource,
  /shopeeGet\([\s\S]*'\/api\/v2\/media_space\/get_video_upload_result'[\s\S]*video_upload_id/,
  'Shopee video upload result must be polled with the media_space get endpoint and video_upload_id'
);

assert.doesNotMatch(
  apiSource,
  /'\/api\/v2\/media_space\/upload_video'/,
  'Shopee video upload must not call the nonexistent single-step media_space/upload_video endpoint'
);

assert.doesNotMatch(
  source,
  /logistics_info: \[\{ logistic_id: 80031, enabled: true \}\]/,
  'Shopee add_item payload must not use logistics_info plural'
);

console.log('shopee-add-item-dimension-logistic-static.test.mjs: ok');
