import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-webhook-simulation.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /BLING_TEST_WEBHOOK_EVENT/, 'script must require an explicit Bling webhook event');
assert.match(source, /BLING_TEST_WEBHOOK_SKU/, 'script must accept an explicit test SKU');
assert.match(source, /BLING_TEST_WEBHOOK_BLING_ID/, 'script must accept an explicit Bling product id');
assert.match(source, /CONFIRM_BLING_WEBHOOK_SIMULATION/, 'script must require explicit webhook simulation confirmation');
assert.match(source, /I_UNDERSTAND_BLING_WEBHOOK_SIMULATION/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/bling-webhook/, 'script must cover the dedicated Bling webhook route');
assert.match(source, /method:\s*'POST'/, 'script must use POST for the webhook simulation');
assert.match(source, /sanitizeBlingWebhookSimulationResponse/, 'script must sanitize webhook simulation responses');
assert.doesNotMatch(source, /sync-prices-vps|reconcile|stock-sync|product-update-fiscal|product-update-dimensions/, 'script must not call unrelated Bling mutations');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|authorization|x-sync-key|apikey/i, 'script must not mention or print secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*sku|console\.log\(.*bling/i, 'script must not print raw webhook bodies or product identifiers');

console.log('vps Bling webhook simulation static checks ok');
