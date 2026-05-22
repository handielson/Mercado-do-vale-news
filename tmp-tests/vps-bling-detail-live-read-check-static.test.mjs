import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-detail-live-read-check.cjs', 'utf8');

assert.match(source, /dotenv\/config/, 'script must load local env files without printing them');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /\/api\/bling\?resource=products/, 'script must discover a product id through VPS product list');
assert.match(source, /\/api\/bling\?resource=product-detail/, 'script must validate product-detail');
assert.match(source, /\/api\/bling\?resource=nfe/, 'script must discover an NFe id through VPS NFe list');
assert.match(source, /\/api\/bling\?resource=nf-detail/, 'script must validate NF detail');
assert.match(source, /sanitizeBlingDetailReadResponse/, 'script must sanitize detail responses');
assert.doesNotMatch(source, /create|update|baixar|cancelar|stock-sync|sync-prices-vps|product-update|fix-profile|fix-bling-id/, 'script must not call mutating Bling resources');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*access/i, 'script must not print raw bodies or tokens');
assert.doesNotMatch(source, /refresh_token|client_secret/i, 'script must not mention or print Bling secrets beyond access token lookup');

console.log('vps Bling detail live read checks static ok');
