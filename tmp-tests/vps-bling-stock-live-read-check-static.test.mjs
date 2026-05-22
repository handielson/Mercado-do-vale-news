import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-stock-live-read-check.cjs', 'utf8');

assert.match(source, /dotenv\/config/, 'script must load local env files without printing them');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /\/api\/bling\?resource=products/, 'script must discover a product id through VPS product list');
assert.match(source, /\/api\/bling\?resource=stock/, 'script must validate Bling stock through VPS');
assert.match(source, /idsProdutos\[\]/, 'script must validate stock filtered by discovered product id');
assert.match(source, /sanitizeBlingStockReadResponse/, 'script must sanitize stock responses');
assert.doesNotMatch(source, /stock-sync|sync-prices-vps|reconcile|create|update|baixar|cancelar|method:\s*'POST'|method:\s*'PUT'|method:\s*'DELETE'/, 'script must not call mutating Bling resources');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*access/i, 'script must not print raw bodies or tokens');
assert.doesNotMatch(source, /refresh_token|client_secret/i, 'script must not mention or print Bling secrets beyond access token lookup');

console.log('vps Bling stock live read checks static ok');
