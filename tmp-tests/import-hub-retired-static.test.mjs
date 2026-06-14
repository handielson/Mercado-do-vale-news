import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const adminLayout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.equal(
  existsSync('pages/admin/import/DataImportExportPage.tsx'),
  false,
  'DataImportExportPage should be removed because the manual import hub is retired'
);

assert.equal(
  existsSync('pages/admin/import/ModelImportPage.tsx'),
  false,
  'ModelImportPage should be removed with the retired import hub'
);

assert.equal(
  existsSync('components/import/LegacySalesImportTab.tsx'),
  false,
  'LegacySalesImportTab should be removed after the final legacy sales/customer migration'
);

assert.equal(
  existsSync('services/dataSyncService.ts'),
  false,
  'DataSyncService should be removed because it is only used by the retired import hub'
);

assert.doesNotMatch(routes, /DataImportExportPage/, 'router must not lazy-load the retired import hub');
assert.doesNotMatch(routes, /\/admin\/import/, 'retired import route must not remain reachable');
assert.doesNotMatch(adminLayout, /\/admin\/import/, 'admin menu must not link to the retired import hub');
assert.doesNotMatch(adminLayout, /Importa[cç][aã]o & Sync VPS/i, 'admin menu must not show the retired import label');

console.log('import hub retirement static checks passed');
