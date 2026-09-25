const test = require('node:test');
const assert = require('node:assert/strict');
const {
  backupTimestamp, localBackupNamesToPrune, synologyArtifactsToPrune, backupPartRanges,
} = require('../services/systemBackupPolicy.cjs');

test('local retention keeps three newest complete packages and ignores unrelated files', () => {
  const names = ['readme.txt', 'mdv-system-v1.0.0-20260901-030000.tar.gz'];
  for (let day = 17; day <= 21; day += 1) {
    const base = `mdv-system-v1.0.0-202609${day}-030000.tar.gz`;
    names.push(base, `${base}.sha256`);
  }
  assert.deepEqual(localBackupNamesToPrune(names), [
    'mdv-system-v1.0.0-20260918-030000',
    'mdv-system-v1.0.0-20260917-030000',
  ]);
  assert.deepEqual(localBackupNamesToPrune(names, { activeName: 'mdv-system-v1.0.0-20260917-030000' }), [
    'mdv-system-v1.0.0-20260918-030000',
  ]);
});

test('NAS retention requires a confirmed set and touches only dated system backup artifacts', () => {
  const old = 'mdv-system-v1.0.0-20260701-030000.tar.gz';
  const recent = 'mdv-system-v1.0.0-20260925-030000.tar.gz';
  const names = [`${old}.part-000`, `${old}.part-001`, `${old}.parts.json`, `${old}.sha256`,
    `${recent}.part-000`, `${recent}.parts.json`, 'n8n-pre-upgrade.tar.gz', 'mdv-system-not-a-backup.tar.gz'];
  const options = { now: Date.UTC(2026, 8, 25), days: 30, keep: 1, confirmedName: recent.slice(0, -7) };
  assert.deepEqual(synologyArtifactsToPrune(names, options), [
    `${old}.part-000`, `${old}.part-001`, `${old}.parts.json`, `${old}.sha256`,
  ]);
  assert.deepEqual(synologyArtifactsToPrune(names, { ...options, confirmedName: null }), []);
  assert.equal(backupTimestamp('mdv-system-v1.0.0-20260925-030000'), Date.UTC(2026, 8, 25, 3));
});

test('ranges cover an archive exactly without creating a second disk copy', () => {
  assert.deepEqual(backupPartRanges(101, 48), [
    { start: 0, end: 47, size: 48, index: 0 },
    { start: 48, end: 95, size: 48, index: 1 },
    { start: 96, end: 100, size: 5, index: 2 },
  ]);
  assert.throws(() => backupPartRanges(0, 48), /invalid_backup_part_size/);
});
