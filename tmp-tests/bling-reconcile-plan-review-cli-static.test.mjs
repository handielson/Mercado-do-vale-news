import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/review-bling-reconcile-plan.mjs', 'utf8');

assert.match(source, /vps-bling-reconcile-dry-run-details-output\.json/, 'review CLI must default to the VPS dry-run details artifact');
assert.match(source, /bling-reconcile-review\.json/, 'review CLI must write the JSON review expected by the guarded apply script');
assert.match(source, /createHash\('sha256'\)/, 'review CLI must hash the exact reviewed dry-run artifact');
assert.match(source, /stock_zeroing_present/, 'review CLI must flag stock zeroing');
assert.match(source, /name_changes_not_limited_to_color_suffix/, 'review CLI must flag unsafe renames');
assert.match(source, /CONFIRM_BLING_RECONCILE_SOURCE_SHA256/, 'markdown review must show the exact source hash confirmation');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|CRON_SECRET/i, 'review CLI must not handle or print secret values');

console.log('bling reconcile plan review CLI static ok');
