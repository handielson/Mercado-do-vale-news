import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/LegacyMigration.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /\.from\('customers'\)/,
  'LegacyMigrationPage must not read or write customers directly through Supabase',
);

assert.match(
  source,
  /customerService\.list\(/,
  'LegacyMigrationPage should compare existing customers through the VPS customer service',
);

assert.match(
  source,
  /customerService\.getByCpfCnpj\(/,
  'LegacyMigrationPage should resolve migrated customers by CPF/CNPJ through the VPS customer service',
);

assert.match(
  source,
  /customerService\.(?:create|update)\(/,
  'LegacyMigrationPage should persist migrated customers through the VPS customer service',
);

console.log('legacy migration customers VPS static checks passed');
