import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'tools/backfill-brand-tags.cjs',
  'tools/backfill-product-descriptions.cjs',
  'tools/backfill-smartphone-model-virtual-ram.cjs',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /@supabase\/supabase-js|createClient|VITE_SUPABASE|SUPABASE_|supabase\.from|Supabase env/,
    `${file} must not depend on Supabase directly`
  );
  assert.match(source, /\/table-data\//, `${file} must use the protected VPS table-data API for dictionary/model tables`);
  assert.match(source, /x-sync-key|X-Sync-Key/i, `${file} must authenticate VPS write/table-data calls with the sync key`);
}

const brandTags = readFileSync('tools/backfill-brand-tags.cjs', 'utf8');
assert.match(brandTags, /\/table-data\/cross_sell_tags/, 'brand tag backfill must manage cross_sell_tags through VPS');

const descriptions = readFileSync('tools/backfill-product-descriptions.cjs', 'utf8');
assert.match(descriptions, /\/table-data\/models/, 'description backfill must read model descriptions through VPS');
assert.match(descriptions, /\/products\/description/, 'description backfill must keep patching product descriptions through VPS');

console.log('VPS backfill tools static checks passed');
