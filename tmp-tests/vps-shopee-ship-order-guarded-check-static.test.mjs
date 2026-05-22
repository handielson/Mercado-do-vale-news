import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-ship-order-guarded-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /SHOPEE_TEST_ORDER_SN/, 'script must require an explicit test order');
assert.match(source, /CONFIRM_SHOPEE_TEST_SHIP_ORDER/, 'script must require an explicit ship_order confirmation');
assert.match(source, /I_UNDERSTAND_SHOPEE_TEST_SHIP_ORDER/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/shopee-actions\?action=ship_order/, 'script must cover ship_order');
assert.match(source, /method:\s*'POST'/, 'script must use POST for ship_order');
assert.match(source, /sanitizeShopeeShipOrderResponse/, 'script must sanitize ship_order responses');
assert.doesNotMatch(source, /update_stock|update_price|add_item|delete_item|upload_image|upload_video/, 'script must not call unrelated mutations');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*order_sn/i, 'script must not print raw Shopee order bodies or order_sn');

console.log('vps Shopee guarded ship_order checks static ok');
