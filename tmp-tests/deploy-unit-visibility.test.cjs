'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ENTRIES, HELPERS, patch } = require('../scripts/deploy-unit-visibility.cjs');

const root = path.resolve(__dirname, '..');
for (const file of ENTRIES) {
  test(`${file}: selective visibility patch preserves unrelated remote changes`, () => {
    const old = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 20e6 });
    const current = fs.readFileSync(path.join(root, file), 'utf8');
    const remote = old + '\n// independent remote change\n';
    assert.equal(patch(remote).replace(/\r\n/g, '\n'),
      (current + '\n// independent remote change\n').replace(/\r\n/g, '\n'));
    assert.equal(patch(patch(remote)), patch(remote));
    assert.throws(() => patch(remote.replace('  const allowed = [', '  // conflicting change\n  const allowed = [')), /drift/);
  });
}

test('selective deployment includes both helpers and read-only preflight', () => {
  const cli = fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8');
  assert.match(cli, /--unit-visibility-only/);
  assert.match(cli, /checkOnly: process\.argv\.includes\('--unit-visibility-check'\)/);
  assert.deepEqual(HELPERS, ['services/unitVisibility.cjs', 'services/unitStatusSchema.cjs']);
});
