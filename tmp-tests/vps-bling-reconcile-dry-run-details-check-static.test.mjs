import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs', 'utf8');

assert.match(source, /resource=reconcile&dryRun=true&details=true/, 'details checker must request dry-run details only');
assert.match(source, /Authorization: Bearer \\\$\{CRON_SECRET\}/, 'details checker should use CRON_SECRET only on the remote shell');
assert.match(source, /vps-bling-reconcile-dry-run-details-output\.json/, 'details checker must save review details to a local JSON artifact');
assert.doesNotMatch(source, /dryRun=false|applyReconcile|method:\s*'POST'|method:\s*"POST"/, 'details checker must not apply changes');
assert.doesNotMatch(source, /console\.log\(.*CRON_SECRET|secret_preview|access_token|refresh_token|client_secret/i, 'details checker must not print secret values');

console.log('vps-bling-reconcile-dry-run-details-check-static ok');
