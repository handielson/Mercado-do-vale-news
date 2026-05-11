import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

function assertMatches(source, pattern, label) {
  assert(pattern.test(source), `${label}: missing pattern ${pattern}`);
}

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = read(file);

  assertMatches(source, /\bdeposit_id\s+CHAR\(36\) NULL/, `${file} units schema`);
  assertMatches(source, /\blocation_id\s+CHAR\(36\) NULL/, `${file} units schema`);
  assertIncludes(source, 'idx_units_deposit_id', `${file} units indexes`);
  assertIncludes(source, 'idx_units_location_id', `${file} units indexes`);
  assertIncludes(source, "await addColumnIfMissing('units', 'deposit_id', 'CHAR(36) NULL')", `${file} migration`);
  assertIncludes(source, "await addColumnIfMissing('units', 'location_id', 'CHAR(36) NULL')", `${file} migration`);
  assertIncludes(source, "'deposit_id'", `${file} update whitelist`);
  assertIncludes(source, "'location_id'", `${file} update whitelist`);
  assertIncludes(source, 'u.deposit_id || null', `${file} unit create payload`);
  assertIncludes(source, 'u.location_id || null', `${file} unit create payload`);
  assertIncludes(source, 'u.deposit_id || null', `${file} batch create payload`);
  assertIncludes(source, 'u.location_id || null', `${file} batch create payload`);

  const syncProductStock = source.match(/async function syncProductStock[\s\S]*?}\n/);
  assert(syncProductStock, `${file}: syncProductStock not found`);
  assertIncludes(syncProductStock[0], "SELECT COUNT(*) FROM units WHERE product_id = ? AND status = 'available'", `${file} syncProductStock stock count`);
  assert(!/deposit_id|location_id/.test(syncProductStock[0]), `${file}: syncProductStock must not filter by deposit or location`);
}

const unitTypes = read('types/unit.ts');
assertIncludes(unitTypes, 'deposit_id?: string | null;', 'Unit type');
assertIncludes(unitTypes, 'location_id?: string | null;', 'Unit type');

const unitService = read('services/units.ts');
assertIncludes(unitService, 'deposit_id: row.deposit_id ?? undefined', 'unit transform');
assertIncludes(unitService, 'location_id: row.location_id ?? undefined', 'unit transform');
assertIncludes(unitService, 'if (input.deposit_id !== undefined) out.deposit_id = input.deposit_id || null;', 'unit payload');
assertIncludes(unitService, 'if (input.location_id !== undefined) out.location_id = input.location_id || null;', 'unit payload');

console.log('vps-units-location-fields-static: ok');
