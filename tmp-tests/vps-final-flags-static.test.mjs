import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('config/migration.ts', 'utf8');

for (const flag of ['customers', 'orders', 'pdv', 'sales']) {
  const enabled = new RegExp(`${flag}:\\s*true`).test(source);
  assert.equal(enabled, true, `USE_VPS.${flag} must be true for the final VPS cutover`);
}

assert.doesNotMatch(
  source,
  /customers:\s*false|orders:\s*false|pdv:\s*false|sales:\s*false/,
  'final cutover flags must not remain false',
);

console.log('vps final flags static checks passed');
