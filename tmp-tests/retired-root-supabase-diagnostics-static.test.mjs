import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const retiredFiles = [
  'check-product-supabase.cjs',
  'check_supabase.cjs',
  'check_supabase_cols.mts',
  'diagnose_supabase.js',
  'test_supa_prods.mjs',
  'test_cat_supa.mjs',
];

for (const file of retiredFiles) {
  assert.equal(
    existsSync(file),
    false,
    `${file} should be removed after VPS/Synology migration diagnostics replaced Supabase ad-hoc checks`
  );
}

const publicBackupHistory = readFileSync('public/backup-history.json', 'utf8');
for (const file of retiredFiles) {
  assert.doesNotMatch(
    publicBackupHistory,
    new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `public backup history should not advertise retired Supabase diagnostic script ${file}`
  );
}

console.log('retired root Supabase diagnostics static checks passed');
