const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { patch } = require('../scripts/deploy-catalog-sale-atomic.cjs');
test('selective deployment is idempotent, preserves unrelated code and refuses drift', () => {
  const base = execFileSync('git', ['show', 'd1f7e3b3aa0d6c8ce58a58a8515c76cdcd6e3165:vps_server.cjs'], { encoding: 'utf8', maxBuffer: 12e6 }).replace(/\r\n/g, '\n');
  const next = fs.readFileSync('vps_server.cjs', 'utf8').replace(/\r\n/g, '\n');
  const remote = '// preserved remote customization\n' + base;
  const result = patch(remote, base, next);
  assert.equal(result, '// preserved remote customization\n' + next);
  assert.equal(patch(result, base, next), result);
  assert.throws(() => patch(remote.replace('async function upsertStockLocationBalance(', 'async function upsertStockLocationBalance(/* drift */ '), base, next), /Remote drift/);
});
