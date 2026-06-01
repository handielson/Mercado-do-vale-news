import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /function normalizeDbValue\(value\)/, `${file} must normalize individual DB values`);
  assert.match(source, /replace\('T', ' '\)/, `${file} must convert ISO datetime separator to MySQL DATETIME format`);
  assert.match(source, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}T/, `${file} must only rewrite full ISO UTC datetime strings`);
  assert.match(source, /normalizeDbValue\(value\)/, `${file} must route normalizeDbPayload entries through normalizeDbValue`);
}

const normalizeDbValue = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return value && typeof value === 'object' ? JSON.stringify(value) : value;
};

assert.equal(normalizeDbValue('2026-06-01T04:15:17.368Z'), '2026-06-01 04:15:17');
assert.equal(normalizeDbValue('2026-06-01T04:15:17Z'), '2026-06-01 04:15:17');
assert.equal(normalizeDbValue('2026-06-01'), '2026-06-01');
assert.equal(normalizeDbValue({ ok: true }), '{"ok":true}');

console.log('mysql datetime normalizer static ok');
