import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/colors.ts', 'utf8');

assert.match(source, /vpsClient/, 'colors service must use the VPS client');
assert.match(source, /\/table-data\/colors\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'colors list must page through VPS table-data');
assert.match(source, /\/table-data\/colors['"]/, 'colors create must post through VPS table-data');
assert.match(source, /\/table-data\/colors\/\$\{encodeURIComponent\(id\)\}\?pk=id/, 'colors update/delete must use the explicit id primary key through VPS');
assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from\('colors'\)|\.from\('colors'\)/, 'colors service must not use Supabase for colors');

console.log('colors service VPS static checks passed');
