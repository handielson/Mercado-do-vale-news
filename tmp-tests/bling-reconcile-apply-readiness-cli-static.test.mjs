import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/check-bling-reconcile-apply-readiness.mjs', 'utf8');

assert.match(source, /review-bling-reconcile-plan\.mjs/, 'readiness CLI must regenerate the local review first');
assert.match(source, /BLING_RECONCILE_PREFLIGHT_ONLY/, 'readiness CLI must run preflight only');
assert.match(source, /apply_not_supported/, 'readiness CLI must refuse --apply');
assert.match(source, /requiredApplyEnv/, 'readiness CLI must print non-secret apply confirmations');
assert.match(source, /CONFIRM_BLING_RECONCILE_SOURCE_SHA256/, 'readiness CLI must include the reviewed source hash');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|CRON_SECRET/i, 'readiness CLI must not handle or print secret values');

console.log('bling reconcile apply readiness CLI static ok');
