import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/import/LegacySalesImportTab.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /supabase\.from\(['"]customers['"]\)/,
  'LegacySalesImportTab must not read customers through Supabase',
);

assert.match(
  source,
  /import \{ customerService \} from ['"]\.\.\/\.\.\/services\/customers['"]/,
  'LegacySalesImportTab should import customerService',
);

assert.match(
  source,
  /customerService\.list\(\)/,
  'LegacySalesImportTab should load customers through customerService/VPS',
);

assert.match(
  source,
  /cpfMap\.set\(c\.cpf_cnpj\.replace\(\/\\D\/g, ''\), \{ id: c\.id, name: c\.name \}\)/,
  'LegacySalesImportTab should keep CPF matching behavior for imported sales',
);

console.log('legacy sales import customers VPS static checks passed');
