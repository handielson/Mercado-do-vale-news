import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const companyContext = readFileSync('services/companyContext.ts', 'utf8');
const legacyMigration = readFileSync('pages/LegacyMigration.tsx', 'utf8');
const blingService = readFileSync('services/blingService.ts', 'utf8');

assert.match(
  companyContext,
  /import\s+\{\s*vpsClient\s+\}\s+from\s+['"]\.\/vpsClient['"]/,
  'companyContext should use vpsClient for company lookup',
);
assert.match(
  companyContext,
  /\/table-data\/companies/,
  'companyContext should resolve company_id through VPS table-data',
);
assert.doesNotMatch(
  companyContext,
  /from\(['"]companies['"]\)/,
  'companyContext must not read companies directly through Supabase',
);

assert.match(
  legacyMigration,
  /import\s+\{\s*getCompanyId\s*\}\s+from\s+['"]\.\.\/services\/companyContext['"]/,
  'LegacyMigration should reuse the VPS-backed company context helper',
);
assert.doesNotMatch(
  legacyMigration,
  /from\(['"]companies['"]\)/,
  'LegacyMigration must not read companies directly through Supabase',
);

assert.match(
  blingService,
  /import\s+\{\s*getCompanyId\s*\}\s+from\s+['"]\.\/companyContext['"]/,
  'blingService should reuse the VPS-backed company context helper',
);
assert.doesNotMatch(
  blingService,
  /from\(['"]companies['"]\)/,
  'blingService must not read companies directly through Supabase',
);

console.log('company context VPS static checks passed');
