const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { patchEntry } = require('../scripts/deploy-catalog-title-upload.cjs');
test('surgical deployment preserves unrelated runtime changes and is idempotent', () => {
    const base = execFileSync('git', ['show', '222c8817:vps_server.cjs'], { encoding: 'utf8', maxBuffer: 10000000 });
    const remote = base + '\n// Independent production change\n';
    const updated = patchEntry(remote);
    assert.ok(updated.endsWith('// Independent production change\n'));
    assert.equal(patchEntry(updated), updated);
    assert.ok(updated.includes('catalogTitleServer.cjs'));
    assert.ok(updated.includes("catalog_title_complement',"));
    assert.ok(updated.includes('return reply;\n});\n\n// DELETE /synology/file'));
    assert.equal(patchEntry(base).replace(/\r\n/g, '\n'), fs.readFileSync('vps_server.cjs', 'utf8').replace(/\r\n/g, '\n'));
});
test('unexpected runtime anchors stop deployment', () => {
    assert.throws(() => patchEntry('unrecognized source'), /release anchor/);
});
