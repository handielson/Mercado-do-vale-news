import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/catalogSectionsService.ts', 'utf8');
const filterStart = source.indexOf('if (section.filter_categories');
const filterEnd = source.indexOf('// Replace with Pinned products', filterStart);

assert(filterStart >= 0 && filterEnd > filterStart, 'catalog section category expansion block should exist');

const filterSource = source.slice(filterStart, filterEnd);

assert(
  /import\s+\{\s*vpsApiService\s+\}\s+from\s+['"]@\/services\/vpsApiService['"]/.test(source),
  'catalogSectionsService should import vpsApiService for category expansion',
);

assert(
  /vpsApiService\.getCategories\(\)/.test(filterSource),
  'catalog section category expansion should load category hierarchy from VPS',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(filterSource),
  'catalog section category expansion must not read categories directly from Supabase',
);

assert(
  /cat\.parent_id\s*&&\s*parentSet\.has\(cat\.parent_id\)/.test(filterSource),
  'catalog section category expansion should preserve parent-child expansion behavior',
);

console.log('catalog section category expansion VPS static checks passed');
