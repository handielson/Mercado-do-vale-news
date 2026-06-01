import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/catalogConfigService.ts', 'utf8');

assert.match(source, /vpsClient/, 'catalog category display config must use the VPS client');
assert.match(source, /\/table-data\/category_display_config\?limit=\$\{pageSize\}&offset=\$\{offset\}/, 'category display config list must page through VPS table-data');
assert.match(source, /\/table-data\/category_display_config['"]/, 'category display config create must post through VPS table-data');
assert.match(source, /\/table-data\/category_display_config\/\$\{encodeURIComponent\(existing\.id\)\}\?pk=id/, 'category display config updates must use the explicit id primary key through VPS');
assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from\('category_display_config'\)|\.from\('category_display_config'\)/, 'catalog config service must not use Supabase for category_display_config');

console.log('catalog category display config VPS static checks passed');
