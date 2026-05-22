import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-bling-diagnostics-live-read-check.cjs', 'utf8');

assert.match(source, /resource=debug-product/, 'live diagnostics check must call debug-product');
assert.match(source, /resource=debug-diagnostic/, 'live diagnostics check must call debug-diagnostic');
assert.match(source, /127\.0\.0\.1:4000/, 'live diagnostics check should call local VPS API from the VPS');
assert.match(source, /vps-bling-reconcile-dry-run-details-output\.json/, 'live diagnostics check should reuse an already discovered Bling ID');
assert.doesNotMatch(source, /Authorization: Bearer|CRON_SECRET|access_token|refresh_token|client_secret/i, 'live diagnostics check must not print or manage secrets');
assert.doesNotMatch(source, /console\.log\(.*debugProductRaw|console\.log\(.*debugDiagnosticRaw/, 'live diagnostics check must not print raw diagnostic bodies');
assert.match(source, /no product names, SKUs, stock quantities, tokens, or raw bodies/, 'live diagnostics check must document sanitized output');

console.log('vps Bling diagnostics live read static checks ok');
