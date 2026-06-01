import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-live-read-check.cjs', 'utf8');

assert.match(source, /dotenv\/config/, 'script must load local env files without printing them');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /BLING_ACCESS_TOKEN|VPS_BLING_ACCESS_TOKEN/, 'script must read an explicit Bling token from env');
assert.doesNotMatch(source, /SUPABASE_URL|VITE_SUPABASE_URL|\/rest\/v1|apikey/i, 'script must not read the retired provider directly');
assert.match(source, /\/api\/bling\?resource=categories/, 'script must validate Bling categories');
assert.match(source, /\/api\/bling\?resource=products/, 'script must validate Bling products');
assert.match(source, /\/api\/bling\?resource=nfe/, 'script must validate Bling NFe list through VPS');
assert.match(source, /\/api\/bling\?resource=nfce/, 'script must validate Bling NFCe list through VPS');
assert.match(source, /sanitizeBlingLiveReadResponse/, 'script must sanitize live Bling responses');
assert.doesNotMatch(source, /create|update|baixar|cancelar|stock-sync|sync-prices-vps|product-update|fix-profile|fix-bling-id/, 'script must not call mutating Bling resources');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*access/i, 'script must not print raw bodies or tokens');
assert.doesNotMatch(source, /refresh_token|client_secret/i, 'script must not mention or print Bling secrets beyond access token lookup');

console.log('vps Bling live read checks static ok');
