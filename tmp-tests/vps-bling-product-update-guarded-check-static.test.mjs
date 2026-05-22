import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-bling-product-update-guarded-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the public VPS API base URL');
assert.match(source, /BLING_PRODUCT_UPDATE_KIND/, 'script must require an explicit product-update kind');
assert.match(source, /BLING_TEST_PRODUCT_UPDATE_BLING_ID/, 'script must require an explicit product id for fiscal updates');
assert.match(source, /BLING_TEST_PRODUCT_UPDATE_BLING_IDS/, 'script must require explicit product ids for dimensions updates');
assert.match(source, /CONFIRM_BLING_PRODUCT_UPDATE/, 'script must require explicit confirmation');
assert.match(source, /I_UNDERSTAND_BLING_PRODUCT_UPDATE/, 'script must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'script must default to dry-run behavior');
assert.match(source, /\/api\/bling\?resource=\$\{resource\}/, 'script must route through the selected Bling product-update resource');
assert.match(source, /product-update-fiscal/, 'script must support fiscal product updates');
assert.match(source, /product-update-dimensions/, 'script must support dimensions product updates');
assert.match(source, /method:\s*'POST'/, 'script must use POST for product updates');
assert.match(source, /sanitizeProductUpdateResponse/, 'script must sanitize product-update responses');
assert.match(source, /mutation_executed:\s*false/, 'script must report no mutation for skipped/dry-run paths');
assert.match(source, /too_many_bling_ids/, 'script must limit dimensions batch size');
assert.doesNotMatch(source, /stock-sync|sync-prices-vps|reconcile|finance|webhook/, 'script must not call unrelated Bling mutations');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|Authorization|CRON_SECRET|VPS_SYNC_KEY|SYNC_SECRET/i, 'script must not mention or print secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response/i, 'script must not print raw response bodies');

console.log('vps Bling guarded product-update static checks ok');
