import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-reconcile-apply-guarded.cjs', 'utf8');

assert.match(source, /CONFIRM_BLING_RECONCILE_APPLY === 'I_UNDERSTAND_BLING_RECONCILE_APPLY'/, 'apply script must require explicit confirmation');
assert.match(source, /process\.env\.DRY_RUN === 'false'/, 'apply script must require DRY_RUN=false');
assert.match(source, /bling-reconcile-review\.json/, 'apply script must read the local reconcile review before applying');
assert.match(source, /MAX_REVIEW_AGE_MS/, 'apply script must define a maximum review age');
assert.match(source, /stale_review/, 'apply script must block stale reconcile reviews before applying');
assert.match(source, /vps-bling-reconcile-dry-run-details-output\.json/, 'apply script must compare review hash to the current dry-run details artifact');
assert.match(source, /review_source_hash_mismatch/, 'apply script must block when review and dry-run details hashes diverge');
assert.match(source, /CONFIRM_BLING_RECONCILE_SOURCE_SHA256/, 'apply script must require explicit confirmation of the reviewed source hash');
assert.match(source, /source_hash_confirmation_mismatch/, 'apply script must block when the confirmed source hash does not match the review');
assert.match(source, /CONFIRM_BLING_RECONCILE_ZEROING === 'I_REVIEWED_STOCK_ZEROING'/, 'apply script must require separate confirmation for stock zeroing');
assert.match(source, /CONFIRM_BLING_RECONCILE_ZEROING_SKUS/, 'apply script must require explicit confirmation of the zeroing SKU list');
assert.match(source, /normalizeSkuList/, 'apply script must normalize the reviewed zeroing SKU list before comparison');
assert.match(source, /stock_zeroing_present/, 'apply script must block reviewed plans with stock zeroing by default');
assert.match(source, /CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES === 'I_REVIEWED_UNSAFE_RENAMES'/, 'apply script must require separate confirmation for unsafe renames');
assert.match(source, /CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS/, 'apply script must require explicit confirmation of unsafe rename SKUs');
assert.match(source, /name_changes_not_limited_to_color_suffix/, 'apply script must block reviewed plans with unsafe renames by default');
assert.match(source, /resource=reconcile"/, 'apply script should call reconcile without dryRun only after confirmation');
assert.match(source, /applied: false/, 'apply script must default to no-op');
assert.doesNotMatch(source, /console\.log\(.*CRON_SECRET|secret_preview|access_token|refresh_token|client_secret/i, 'apply script must not print secret values');

console.log('vps-bling-reconcile-apply-guarded-static ok');
