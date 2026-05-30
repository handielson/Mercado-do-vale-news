import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-finance-live-read-check.cjs', 'utf8');

assert.match(source, /dotenv\/config/, 'script must load local env files without printing them');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /\/api\/bling\?resource=finance&resourceType=receber&action=list/, 'script must validate finance receber list');
assert.match(source, /\/api\/bling\?resource=finance&resourceType=pagar&action=list/, 'script must validate finance pagar list');
assert.match(source, /action=get/, 'script must validate finance get from a discovered id');
assert.match(source, /action=get-bordero/, 'script must validate finance bordero reads from a discovered id');
assert.match(source, /sanitizeBlingFinanceReadResponse/, 'script must sanitize finance responses');
assert.doesNotMatch(source, /action=create|action=update|action=baixar|action=cancelar|method:\s*'POST'|method:\s*'PUT'|method:\s*'DELETE'/, 'script must not call finance mutations');
assert.doesNotMatch(source, /console\.log\(.*body|console\.log\(.*response|console\.log\(.*access/i, 'script must not print raw bodies or tokens');
assert.doesNotMatch(source, /refresh_token|client_secret/i, 'script must not mention or print Bling secrets beyond access token lookup');

console.log('vps Bling finance live read checks static ok');
