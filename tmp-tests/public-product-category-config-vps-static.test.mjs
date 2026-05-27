import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert(
  !/from\(['"]categories['"]\)/.test(source),
  'PublicProductPage must not read categories directly from Supabase',
);

assert(
  /setCategoryConfig\(vpscat\.config\)/.test(source),
  'PublicProductPage should use category config returned by VPS categories',
);

console.log('public product category config VPS static checks passed');
