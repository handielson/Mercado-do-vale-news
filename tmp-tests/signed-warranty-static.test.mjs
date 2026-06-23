import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const migration = read('migrations/007_signed_warranty_documents.sql');
const pkg = JSON.parse(read('package.json'));
const servers = [read('vps_server.js'), read('vps_server.cjs')];

assert.match(migration, /CREATE TABLE signed_warranty_documents/);
assert.match(migration, /image_sha256 CHAR\(64\)/);
assert.match(migration, /pdf_sha256 CHAR\(64\)/);
assert.match(migration, /version_number INT/);
assert.match(migration, /is_active TINYINT/);
assert.equal(pkg.dependencies.sharp !== undefined, true);
assert.equal(pkg.dependencies['pdf-lib'] !== undefined, true);
for (const server of servers) {
  assert.match(server, /CREATE TABLE IF NOT EXISTS signed_warranty_documents/);
}
console.log('signed warranty static checks passed');
