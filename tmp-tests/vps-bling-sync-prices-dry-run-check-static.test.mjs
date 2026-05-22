import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-sync-prices-dry-run-check.cjs', 'utf8');

assert.match(source, /resource=sync-prices-vps&page=\$\{page\}&dryRun=true/, 'checker must force sync-prices-vps dryRun=true');
assert.match(source, /-X POST/, 'checker must use the production route method while still dry-running');
assert.match(source, /127\.0\.0\.1:4000/, 'checker should call local VPS API from the VPS');
assert.doesNotMatch(source, /Authorization: Bearer|CRON_SECRET|VPS_SYNC_KEY|SYNC_SECRET|access_token|refresh_token|client_secret/i, 'checker must not print or manage secrets');
assert.doesNotMatch(source, /dryRun=false|127\.0\.0\.1:4000\/products\/batch/, 'checker must not trigger batch writes directly');
assert.equal(source.split(/\r?\n/).some((line) => /curl.*\/products\/batch/.test(line)), false, 'checker must not curl products batch directly');
assert.match(source, /No \/products\/batch write is executed/, 'checker must state it is non-mutating');

console.log('vps Bling sync-prices dry-run checker static ok');
