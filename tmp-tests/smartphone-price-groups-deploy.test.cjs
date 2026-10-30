const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { patchModule, BASELINE, FILE } = require('../scripts/deploy-smartphone-price-groups.cjs');
test('price-group module deploy accepts the published baseline, is idempotent and rejects drift', () => {
    const before = execFileSync('git', ['show', `${BASELINE}:${FILE}`], { encoding: 'utf8' });
    const after = fs.readFileSync(FILE, 'utf8');
    assert.equal(patchModule(before, before, after), after);
    assert.equal(patchModule(after, before, after), after);
    assert.throws(() => patchModule(before + '\n// external edit', before, after), /drift/);
    const entry = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
    assert.match(entry, /--smartphone-price-groups-only[\s\S]*deploy-smartphone-price-groups\.cjs[\s\S]*conn.end\(\); return;/);
    const script = fs.readFileSync('scripts/deploy-smartphone-price-groups.cjs', 'utf8');
    assert.match(script, /files: \[FILE\]/, 'selective deploy cannot replace entrypoints or other services');
});
