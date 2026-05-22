import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-live-read-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must call the VPS API host');
assert.match(source, /\/api\/shopee-actions\?action=get_shop_info/, 'script must validate Shopee actions shop_info');
assert.match(source, /\/api\/shopee-catalog\?action=shop_info/, 'script must validate Shopee catalog shop_info');
assert.match(source, /\/api\/shopee-catalog\?action=categories/, 'script must validate Shopee catalog categories');
assert.match(source, /\/api\/shopee-catalog\?action=logistics_channel_list/, 'script must validate Shopee logistics channels');
assert.match(source, /\/api\/shopee-catalog\?action=get_item_list/, 'script must validate Shopee item list');
assert.match(source, /\/api\/shopee-catalog\?action=get_item_base_info/, 'script must validate Shopee item base info from a discovered item');
assert.match(source, /\/api\/shopee-catalog\?action=get_model_list/, 'script must validate Shopee model list from a discovered item');
assert.match(source, /extractFirstShopeeItemId/, 'script must discover an item_id without hardcoding one');
assert.match(source, /sanitizeShopeeLiveReadResponse/, 'script must sanitize live Shopee responses');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /update_stock|update_price|ship_order|add_item|delete_item|upload_image|upload_video/, 'script must not call mutating Shopee actions');

console.log('vps Shopee live read checks static ok');
