import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const retiredFiles = [
  'read_supabase.mjs',
  'cruzar-vps-supabase.cjs',
  'sync-vps-images-to-supabase.cjs',
  'scripts/insert-test-products.sql',
  'scripts/migrate-auth.ts',
  'scripts/migrate_shipping.js',
  'scripts/run-ean-migration.ts',
  'scripts/run-migration.ts',
  'scripts/test-sale.ts',
  'scripts/update-field-types.js',
];

for (const file of retiredFiles) {
  assert.equal(
    existsSync(file),
    false,
    `${file} should be retired because manual Supabase scripts must not remain in the VPS/Synology migration path`
  );
}

const tsconfig = readFileSync('tsconfig.json', 'utf8');
for (const file of retiredFiles) {
  assert.doesNotMatch(
    tsconfig,
    new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `tsconfig should not reference retired Supabase manual script ${file}`
  );
}

console.log('retired Supabase manual scripts static checks passed');
