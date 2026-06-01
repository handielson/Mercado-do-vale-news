import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/catalogSectionsService.ts', 'utf8');

assert.match(source, /vpsClient/, 'catalog sections CRUD must use the VPS client');
assert.match(source, /\/table-data\/catalog_sections\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'catalog sections list must page through the VPS table-data endpoint');
assert.match(source, /\/table-data\/catalog_sections['"]/, 'catalog sections create must post through VPS table-data');
assert.match(source, /\/table-data\/catalog_sections\/\$\{encodeURIComponent\(id\)\}\?pk=id/, 'catalog sections update/delete must use the explicit id primary key through VPS');
assert.doesNotMatch(source, /\.from\('catalog_sections'\)|supabase\.from\('catalog_sections'\)/, 'catalog sections service must not read or mutate catalog_sections through Supabase');
assert.doesNotMatch(source, /supabase\.auth\.getUser/, 'catalog sections service must not depend on Supabase auth for createSection user_id');

console.log('catalog sections VPS CRUD static checks passed');
