import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.js', 'utf8');
const callbackStart = source.indexOf('async function handleBlingOAuthCallbackVps');
assert.notEqual(callbackStart, -1, 'Bling OAuth callback handler must exist');
const callback = source.slice(callbackStart, source.indexOf('async function handleBlingApiVps', callbackStart));

assert.match(
  callback,
  /sanitizeBlingOAuthErrorMessage\(/,
  'Bling OAuth callback must sanitize upstream error details before logging or redirecting',
);

assert.match(
  callback,
  /console\.warn\('\[bling-oauth-callback\] token exchange failed'/,
  'Bling OAuth callback must log sanitized token exchange failures for production diagnosis',
);

assert.match(
  callback,
  /token_exchange_failed&status=\$\{response\.status\}&detail=/,
  'Bling OAuth callback must redirect with sanitized failure detail for the admin UI',
);

console.log('Bling OAuth callback diagnostics static checks ok');
