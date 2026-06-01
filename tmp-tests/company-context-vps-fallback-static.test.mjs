import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/companyContext.ts', 'utf8');

assert.match(source, /DEFAULT_COMPANY_ID/, 'company context must define a stable VPS default company id');
assert.match(source, /9717131e-7b14-4aec-84a4-4317c0489985/, 'company context must use the migrated VPS company id fallback');
assert.match(source, /catch\s*\(/, 'company context must catch missing companies table/API failures');
assert.match(source, /return\s+DEFAULT_COMPANY_ID/, 'company context must return the default id when companies lookup fails');

console.log('company context VPS fallback static checks passed');
