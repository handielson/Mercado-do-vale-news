import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-external-cutover-read-only-check.cjs', 'utf8');

assert.match(source, /VPS_EXTERNAL_CUTOVER_LIVE/, 'live check must require an explicit read-only live flag');
assert.match(source, /\/api\/bling-webhook/, 'live check must cover Bling webhook route');
assert.match(source, /\/api\/mercadopago-webhook/, 'live check must cover Mercado Pago webhook route');
assert.match(source, /\/api\/shopee-webhook/, 'live check must cover Shopee webhook route');
assert.match(source, /\/api\/auth\/callback\/bling/, 'live check must cover Bling OAuth callback route');
assert.match(source, /\/api\/shopee\?action=callback/, 'live check must cover Shopee OAuth callback route');
assert.match(source, /method:\s*'GET'/, 'live check must only use GET requests');
assert.match(source, /redirect:\s*'manual'/, 'live check must inspect callback redirects without following into the app');
assert.match(source, /route_probe_sent:\s*false/, 'default mode must not probe live routes');
assert.doesNotMatch(source, /method:\s*'POST'|method:\s*"POST"|CONFIRM_|setWebhook|deleteWebhook|crontab\s+-/i, 'live check must not send payloads or alter external registrations');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret|service_role/i, 'live check must not mention or print secrets');

console.log('vps external cutover read-only check static ok');
