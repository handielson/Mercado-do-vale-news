import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ModelsPage.tsx', 'utf8');

assert.match(
  page,
  /function normalizeModelSearchText\(value: string\)/,
  'ModelsPage must expose a shared text normalizer for search',
);

assert.match(
  page,
  /\.normalize\('NFD'\)[\s\S]*\.replace\(\s*\/\[\\u0300-\\u036f\]\+\/g,\s*''\s*\)/,
  'model search normalizer must remove accents so "pro" matches "pró"',
);

assert.match(
  page,
  /const brandName = normalizeModelSearchText\(getBrandName\(m\.brand_id\)\);[\s\S]*const term = normalizeModelSearchText\(search\);[\s\S]*!normalizeModelSearchText\(m\.name\)\.includes\(term\)/,
  'model filtering must compare normalized model names, brand names, and search terms',
);

console.log('model search accent-insensitive static test ok');
