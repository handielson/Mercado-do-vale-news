import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-sync-prices-apply-guarded.cjs', 'utf8');

assert.match(source, /CONFIRM_BLING_SYNC_PRICES_APPLY === 'I_UNDERSTAND_BLING_SYNC_PRICES_APPLY'/, 'apply script must require explicit confirmation');
assert.match(source, /process\.env\.DRY_RUN === 'false'/, 'apply script must require DRY_RUN=false');
assert.match(source, /resource=sync-prices-vps&page=\$\{page\}"/, 'apply script should call sync-prices-vps without dryRun only after confirmation');
assert.match(source, /applied: false/, 'apply script must default to no-op');
assert.doesNotMatch(source, /Authorization: Bearer|CRON_SECRET|VPS_SYNC_KEY|SYNC_SECRET|access_token|refresh_token|client_secret/i, 'apply script must not print or manage secrets');

console.log('vps Bling sync-prices apply guarded static ok');
