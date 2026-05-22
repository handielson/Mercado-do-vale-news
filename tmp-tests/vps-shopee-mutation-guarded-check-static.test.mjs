import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-mutation-guarded-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /SHOPEE_TEST_PRODUCT_ID/, 'script must require an explicit test product id');
assert.match(source, /CONFIRM_SHOPEE_TEST_MUTATION/, 'script must require an explicit mutation confirmation');
assert.match(source, /I_UNDERSTAND_SHOPEE_TEST_MUTATION/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/shopee-actions\?action=update_stock/, 'script must cover update_stock');
assert.match(source, /\/api\/shopee-actions\?action=update_price/, 'script must cover update_price');
assert.match(source, /method:\s*'POST'/, 'script must use POST for mutations');
assert.match(source, /sanitizeShopeeMutationResponse/, 'script must sanitize mutation responses');
assert.doesNotMatch(source, /ship_order|add_item|delete_item|upload_image|upload_video/, 'script must not call unrelated mutations');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response/i, 'script must not print raw Shopee response bodies');

console.log('vps Shopee guarded mutation checks static ok');
