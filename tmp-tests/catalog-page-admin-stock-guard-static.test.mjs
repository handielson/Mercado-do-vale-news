import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/catalog/index.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /includeOutOfStockForView\s*=\s*isAdmin/,
  'public catalog grouping must not show out-of-stock products just because the viewer is an admin',
);

assert.match(
  source,
  /groupProductsByVariants\(products,\s*false\)/,
  'public catalog grouping should use only sellable in-stock products for the initial/catalog grid',
);

console.log('catalog page admin stock guard static checks passed');
