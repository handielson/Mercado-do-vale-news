import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/backfill-smartphone-model-virtual-ram.cjs', 'utf8');

assert.match(source, /const APPLY = process\.argv\.includes\('--apply'\)/, 'script must default to dry-run unless --apply is passed');
assert.match(source, /const FIELD_KEY = 'memoria_ram_virtual'/, 'script must target memoria_ram_virtual');
assert.match(source, /const CATEGORY_NAMES = new Set\(\['smartphones', 'celulares'\]\)/, 'script must target only exact Smartphone/Celular categories');
assert.match(source, /CATEGORY_NAMES\.has\(String\(category\.name \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/, 'script must avoid accessory categories such as Suporte para Celulares');
assert.match(source, /hasOwnProperty\.call\(templateValues, FIELD_KEY\)/, 'script must preserve models where the field already exists');
assert.match(source, /\.\.\.templateValues,\s*\[FIELD_KEY\]: DEFAULT_VALUE/s, 'script must merge with existing template_values instead of replacing them');
assert.doesNotMatch(source, /@supabase\/supabase-js|createClient|VITE_SUPABASE|SUPABASE_|supabase\.from/, 'script must not depend on Supabase directly');
assert.match(source, /\/table-data\/categories/, 'script must read categories through the protected VPS table-data API');
assert.match(source, /\/table-data\/models/, 'script must read and patch models through the protected VPS table-data API');
assert.match(source, /x-sync-key/i, 'script must authenticate VPS table-data calls with the sync key');
assert.match(source, /body: JSON\.stringify\(\{ template_values: nextTemplateValues \}\)/, 'script must only patch template_values');

console.log('smartphone model virtual ram backfill static checks passed');
