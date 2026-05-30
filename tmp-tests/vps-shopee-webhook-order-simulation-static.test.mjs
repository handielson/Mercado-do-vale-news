import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-webhook-order-simulation.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /SHOPEE_TEST_WEBHOOK_ORDER_SN/, 'script must require an explicit simulated order sn');
assert.match(source, /SHOPEE_TEST_WEBHOOK_STATUS/, 'script must require an explicit simulated status');
assert.match(source, /CONFIRM_SHOPEE_WEBHOOK_ORDER_SIMULATION/, 'script must require explicit webhook simulation confirmation');
assert.match(source, /I_UNDERSTAND_SHOPEE_WEBHOOK_ORDER_SIMULATION/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/shopee-webhook/, 'script must cover the Shopee webhook route');
assert.match(source, /code:\s*3/, 'script must simulate Shopee order status update code 3');
assert.match(source, /method:\s*'POST'/, 'script must use POST for the webhook simulation');
assert.match(source, /sanitizeShopeeWebhookSimulationResponse/, 'script must sanitize webhook simulation responses');
assert.doesNotMatch(source, /update_stock|update_price|add_item|delete_item|upload_image|upload_video|ship_order/, 'script must not call Shopee mutations');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*ordersn|console\.log\(.*order_sn/i, 'script must not print raw webhook bodies or order ids');

console.log('vps Shopee webhook order simulation static checks ok');
