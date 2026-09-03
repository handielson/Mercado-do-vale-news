import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeCatalogSearchParams } from '../pages/catalog/catalogCollections.js';

const catalogPage = readFileSync('pages/catalog/index.tsx', 'utf8');

const sanitized = sanitizeCatalogSearchParams(
  new URLSearchParams('srsltid=google-result-id&categoria=Smartphones&page=2&search=poco'),
);

assert.equal(sanitized.has('srsltid'), false, 'Google result id must leave the visible catalog URL');
assert.equal(sanitized.get('categoria'), 'Smartphones', 'category name must be preserved');
assert.equal(sanitized.get('page'), '2', 'catalog pagination must be preserved');
assert.equal(sanitized.get('search'), 'poco', 'catalog search must be preserved');

const caseInsensitive = sanitizeCatalogSearchParams(
  new URLSearchParams('SRSLTID=google-result-id&categoria=Smartphones'),
);
assert.equal(caseInsensitive.has('SRSLTID'), false, 'tracking parameter cleanup must be case-insensitive');

assert.match(
  catalogPage,
  /const newParams = sanitizeCatalogSearchParams\(prevParams\)[\s\S]*let changed = newParams\.toString\(\) !== prevParams\.toString\(\)[\s\S]*\{ replace: true \}/,
  'catalog must sanitize tracking and synchronize search in the same URL update',
);

console.log('catalog URL tracking parameter guard passed');
