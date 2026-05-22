import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-reconcile-dry-run-check.cjs', 'utf8');

assert.match(source, /resource=reconcile&dryRun=true/, 'dry-run checker must force reconcile dryRun=true');
assert.match(source, /http:\/\/127\.0\.0\.1:4000\/api\/bling/, 'dry-run checker should call the local VPS API from the VPS');
assert.match(source, /Authorization: Bearer \\\$\{CRON_SECRET\}/, 'dry-run checker should use CRON_SECRET only as a remote bearer header');
assert.match(source, /body\.dryRun !== true/, 'dry-run checker must reject non-dryRun responses');
assert.doesNotMatch(source, /dryRun=false|applyReconcile|stock-sync|sync-prices-vps|method:\s*'POST'|method:\s*"POST"/, 'dry-run checker must not apply mutations');
assert.doesNotMatch(source, /console\.log\(.*CRON_SECRET|secret_preview|access_token|refresh_token|client_secret/i, 'dry-run checker must not print secret values');
assert.match(source, /stockChanges/, 'dry-run checker should summarize stock changes');
assert.match(source, /nameChanges/, 'dry-run checker should summarize name changes');

console.log('vps-bling-reconcile-dry-run-check-static ok');
