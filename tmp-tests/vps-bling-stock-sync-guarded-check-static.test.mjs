import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-bling-stock-sync-guarded-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the public VPS API base URL');
assert.match(source, /BLING_TEST_STOCK_SYNC_BLING_ID/, 'script must require an explicit Bling product id');
assert.match(source, /BLING_TEST_STOCK_SYNC_QUANTITY/, 'script must require an explicit stock-sync quantity');
assert.match(source, /CONFIRM_BLING_STOCK_SYNC/, 'script must require explicit confirmation');
assert.match(source, /I_UNDERSTAND_BLING_STOCK_SYNC/, 'script must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'script must default to dry-run behavior');
assert.match(source, /\/api\/bling\?resource=stock-sync/, 'script must only call the stock-sync resource');
assert.match(source, /method:\s*'POST'/, 'script must use POST for stock-sync');
assert.match(source, /sanitizeBlingStockSyncResponse/, 'script must sanitize stock-sync responses');
assert.match(source, /mutation_executed:\s*false/, 'script must report no mutation for skipped/dry-run paths');
assert.doesNotMatch(source, /sync-prices-vps|reconcile|product-update-fiscal|product-update-dimensions|finance/, 'script must not call unrelated Bling mutations');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|Authorization|CRON_SECRET|VPS_SYNC_KEY|SYNC_SECRET/i, 'script must not mention or print secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response/i, 'script must not print raw response bodies');

console.log('vps Bling guarded stock-sync static checks ok');
