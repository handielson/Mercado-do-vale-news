import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');
const service = readFileSync('services/blingService.ts', 'utf8');

assert.ok(
  !/setImportModelId\(sorted\[0\]\.id\)/.test(page),
  'Bling import page must not auto-select the newest model by default',
);

assert.ok(
  /validImportModelId/.test(service),
  'Bling import service should resolve a validated model id before inserting products',
);

assert.ok(
  /selected-model-missing/.test(service),
  'Bling import service should log when a selected model id is stale or removed',
);

assert.ok(
  /mapBlingToDb\([^)]*validImportModelId/.test(service),
  'Bling import rows should be built with the validated model id, not the raw selected id',
);

console.log('ok');
