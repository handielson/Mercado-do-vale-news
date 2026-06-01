import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingService.ts', 'utf8');
const searchStart = source.indexOf('export async function searchBlingProducts');
const searchEnd = source.indexOf('export async function findBlingProductByExactSku', searchStart);
const searchBody = source.slice(searchStart, searchEnd);

assert.ok(searchStart > -1 && searchEnd > searchStart, 'searchBlingProducts must exist');
assert.match(
  source,
  /function isBlingAuthFailure\(/,
  'Bling service must centralize invalid-token detection',
);
assert.match(
  searchBody,
  /let accessToken = await getValidToken\(\)/,
  'Bling search must keep a replaceable token for retry',
);
assert.match(
  searchBody,
  /if \(!hasRetriedAfterAuthFailure && isBlingAuthFailure\(/,
  'Bling search must detect invalid-token proxy responses before throwing',
);
assert.match(
  searchBody,
  /accessToken = await getValidToken\(\{\s*forceRefresh:\s*true\s*\}\)/,
  'Bling search must force refresh the token after invalid_token',
);
assert.match(
  searchBody,
  /continue;/,
  'Bling search must retry the same page after token refresh',
);

console.log('bling search invalid-token refresh static checks passed');
