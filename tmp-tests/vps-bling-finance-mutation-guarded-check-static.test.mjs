import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-bling-finance-mutation-guarded-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the public VPS API base URL');
assert.match(source, /BLING_FINANCE_TEST_ACTION/, 'script must require an explicit finance action');
assert.match(source, /BLING_FINANCE_TEST_RESOURCE_TYPE/, 'script must require pagar or receber');
assert.match(source, /BLING_FINANCE_TEST_AUTHORIZATION/, 'script must read Authorization only from an explicit env var');
assert.match(source, /BLING_FINANCE_TEST_BODY_JSON/, 'script must read mutation body only from an explicit env var');
assert.match(source, /CONFIRM_BLING_FINANCE_MUTATION/, 'script must require explicit confirmation');
assert.match(source, /I_UNDERSTAND_BLING_FINANCE_MUTATION/, 'script must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'script must default to dry-run behavior');
assert.match(source, /create/, 'script must support finance create');
assert.match(source, /update/, 'script must support finance update');
assert.match(source, /baixar/, 'script must support finance baixar');
assert.match(source, /cancelar/, 'script must support finance cancelar');
assert.match(source, /const method = ACTION_METHODS\[ACTION\]/, 'script must derive HTTP method from action');
assert.match(source, /\/api\/bling\?resource=finance/, 'script must only call the Bling finance resource');
assert.match(source, /sanitizeFinanceMutationResponse/, 'script must sanitize finance mutation responses');
assert.match(source, /mutation_executed:\s*false/, 'script must report no mutation for skipped/dry-run paths');
assert.doesNotMatch(source, /stock-sync|sync-prices-vps|reconcile|product-update-fiscal|product-update-dimensions|webhook/, 'script must not call unrelated Bling mutations');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|CRON_SECRET|VPS_SYNC_KEY|SYNC_SECRET/i, 'script must not mention unrelated secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response/i, 'script must not print raw response bodies');

console.log('vps Bling guarded finance mutation static checks ok');
