import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-order-live-read-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must call the VPS API host');
assert.match(source, /\/api\/shopee-actions\?action=get_order_list/, 'script must validate Shopee order list');
assert.match(source, /\/api\/shopee-actions\?action=get_order_detail/, 'script must validate Shopee order detail from a discovered order');
assert.match(source, /\/api\/shopee-actions\?action=get_tracking_info/, 'script must validate tracking info from a discovered order');
assert.match(source, /\/api\/shopee-actions\?action=get_escrow_detail/, 'script must validate escrow detail from a discovered order');
assert.match(source, /extractFirstShopeeOrderSn/, 'script must discover an order_sn without hardcoding one');
assert.match(source, /sanitizeShopeeOrderReadResponse/, 'script must sanitize live Shopee order responses');
assert.match(source, /sensitiveKeyPattern/, 'script must filter sensitive order keys before printing response metadata');
assert.match(source, /Object\.keys\(response\)\.filter/, 'script must not print raw response key lists');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response/i, 'script must not print raw order response bodies');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /ship_order|add_item|update_stock|update_price|delete_item|upload_image|upload_video/, 'script must not call mutating Shopee actions');

console.log('vps Shopee order live read checks static ok');
