import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['tools/check-bling-reconcile-apply-readiness.mjs', '--apply'],
  { cwd: process.cwd(), encoding: 'utf8' },
);

assert.notEqual(result.status, 0);
assert.match(result.stderr, /apply_not_supported/);

console.log('bling reconcile apply readiness CLI refuses apply ok');
