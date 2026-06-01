import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/brands.ts', 'utf8');

assert.match(
  source,
  /return \(await list\(\)\)\.filter\(brand => brand\.active\)/,
  'brandService.listActive must filter active rows after VPS normalization'
);

assert.doesNotMatch(
  source,
  /\.or\(['"]active\.eq\.true,active\.is\.null['"]\)|\.eq\(['"]active['"],\s*true\)/,
  'brandService.listActive must not use Supabase active filters after VPS-only migration'
);

console.log('brand list active null filter regression ok');
