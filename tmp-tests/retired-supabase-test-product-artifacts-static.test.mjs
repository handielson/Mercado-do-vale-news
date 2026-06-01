import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const retiredFiles = [
  'public/catalog-test.html',
  'scripts/browser-create-test-products.js',
  'scripts/create-test-inventory.ts',
];

for (const file of retiredFiles) {
  assert.equal(
    existsSync(file),
    false,
    `${file} should be retired because test product/catalog creation must not use Supabase directly`
  );
}

const tsconfig = readFileSync('tsconfig.json', 'utf8');
for (const file of retiredFiles) {
  assert.doesNotMatch(
    tsconfig,
    new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `tsconfig should not reference retired Supabase test artifact ${file}`
  );
}

console.log('retired Supabase test product artifacts static checks passed');
