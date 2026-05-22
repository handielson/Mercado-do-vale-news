import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-mercadopago-webhook-simulation.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /MERCADOPAGO_TEST_PAYMENT_ID/, 'script must require an explicit payment id');
assert.match(source, /CONFIRM_MERCADOPAGO_WEBHOOK_SIMULATION/, 'script must require explicit webhook simulation confirmation');
assert.match(source, /I_UNDERSTAND_MERCADOPAGO_WEBHOOK_SIMULATION/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/mercadopago-webhook/, 'script must cover the Mercado Pago webhook route');
assert.match(source, /type:\s*'payment'/, 'script must simulate a Mercado Pago payment webhook');
assert.match(source, /method:\s*'POST'/, 'script must use POST for the webhook simulation');
assert.match(source, /sanitizeMercadoPagoWebhookSimulationResponse/, 'script must sanitize webhook simulation responses');
assert.doesNotMatch(source, /orders|supabaseRestPatch|payment_status|status:\s*'paid'/, 'script must not implement local order mutation logic');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|authorization|apikey|service_role/i, 'script must not mention or print secrets');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*payment/i, 'script must not print raw webhook bodies or payment ids');

console.log('vps Mercado Pago webhook simulation static checks ok');
