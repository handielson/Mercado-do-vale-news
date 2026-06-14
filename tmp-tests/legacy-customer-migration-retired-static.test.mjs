import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const adminLayout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.equal(
  existsSync('pages/LegacyMigration.tsx'),
  false,
  'customer legacy migration page should be removed after final customer migration'
);

assert.equal(
  existsSync('pages/FieldMappingPage.tsx'),
  false,
  'legacy customer field mapping page should be removed with the retired migration flow'
);

for (const file of [
  'components/migration/CustomerMigrationTable.tsx',
  'components/migration/CustomerMigrateModal.tsx',
  'components/migration/CustomerDetailsModal.tsx',
]) {
  assert.equal(existsSync(file), false, `${file} should be removed with the retired migration page`);
}

assert.doesNotMatch(routes, /LegacyMigrationPage/, 'router must not lazy-load the retired customer migration page');
assert.doesNotMatch(routes, /FieldMappingPage/, 'router must not lazy-load the retired customer field mapping page');
assert.doesNotMatch(routes, /\/admin\/migration/, 'retired customer migration route must not remain reachable');
assert.doesNotMatch(routes, /\/admin\/field-mapping/, 'retired field mapping route must not remain reachable');
assert.doesNotMatch(adminLayout, /\/admin\/migration/, 'admin menu must not link to the retired customer migration page');

const importHub = readFileSync('pages/admin/import/DataImportExportPage.tsx', 'utf8');
assert.doesNotMatch(importHub, /Clientes \(Migra/, 'import hub must not show the retired customer migration placeholder tab');

console.log('legacy customer migration retirement static checks passed');
