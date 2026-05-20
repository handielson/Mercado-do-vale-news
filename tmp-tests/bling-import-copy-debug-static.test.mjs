import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/blingService.ts', 'utf8');
const page = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');

assert.ok(
  /debug:\s*ImportErrorDebug/.test(service),
  'ImportErrorDetail should expose a structured debug payload',
);

assert.ok(
  /rawMessage/.test(service) && /resolvedCategoryId/.test(service) && /validImportModelId/.test(service),
  'Import debug should include raw error, resolved category, and validated model context',
);

assert.ok(
  /copyImportErrorDebug/.test(page),
  'BlingPage should include a helper to copy import error debug JSON',
);

assert.ok(
  /Copiar debug/.test(page),
  'Each import error should render a Copiar debug button',
);

assert.ok(
  /Copiar todos/.test(page),
  'Import result should render a button to copy all error debug payloads',
);

console.log('ok');
