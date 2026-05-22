import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-add-item-media-guarded-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /SHOPEE_TEST_WRITE_KIND/, 'script must require an explicit Shopee write kind');
assert.match(source, /SHOPEE_TEST_ADD_ITEM_PRODUCT_ID/, 'script must require an explicit product id for add_item');
assert.match(source, /SHOPEE_TEST_MEDIA_DATA_URL/, 'script must require explicit media data for uploads');
assert.match(source, /CONFIRM_SHOPEE_TEST_ADD_ITEM_MEDIA/, 'script must require explicit confirmation');
assert.match(source, /I_UNDERSTAND_SHOPEE_TEST_ADD_ITEM_MEDIA/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/shopee-actions\?action=add_item/, 'script must cover shopee-actions add_item');
assert.match(source, /\/api\/shopee-catalog\?action=upload_image/, 'script must cover catalog upload_image');
assert.match(source, /\/api\/shopee-catalog\?action=upload_video/, 'script must cover catalog upload_video');
assert.match(source, /method:\s*'POST'/, 'script must use POST for Shopee writes');
assert.match(source, /sanitizeShopeeAddItemMediaResponse/, 'script must sanitize Shopee write responses');
assert.match(source, /mutation_executed:\s*false/, 'script must report no mutation for skipped/dry-run paths');
assert.doesNotMatch(source, /update_stock|update_price|ship_order|delete_item/, 'script must not call unrelated Shopee mutations');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*product_id|console\.log\(.*data_url/i, 'script must not print raw Shopee bodies, product ids, or media data');

console.log('vps Shopee guarded add_item/media checks static ok');
