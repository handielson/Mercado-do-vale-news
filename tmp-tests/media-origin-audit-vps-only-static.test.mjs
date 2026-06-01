import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('tools/audit-media-origins.mjs', 'utf8');

assert.doesNotMatch(
  source,
  /@supabase\/supabase-js|createClient|VITE_SUPABASE|SUPABASE_|supabase\.from|Supabase-backed|Supabase:/,
  'media origin audit must not read Supabase directly'
);
assert.match(source, /\/table-data\/\$\{tableName\}/, 'media origin audit must read table rows through VPS table-data');
assert.match(source, /model_color_images/, 'media origin audit must include model color images in the VPS audit');
assert.match(source, /\/company-settings/, 'media origin audit must read company settings through VPS');
assert.match(source, /catalog_banners/, 'media origin audit must include catalog banners in the VPS audit');
assert.match(source, /x-sync-key/i, 'media origin audit must authenticate protected VPS reads with sync key');
assert.match(source, /Model\/color rows from VPS/, 'markdown report must label model/color source as VPS');

console.log('media origin audit VPS-only static checks passed');
