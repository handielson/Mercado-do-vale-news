import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

assert.match(
  source,
  /equivalentProductIds\.map\(productId => unitService\.listByProduct\(productId\)\)/,
  'ProductCard must load serialized units from every equivalent product record',
);

assert.match(
  source,
  /unitIdentifierChips/,
  'ProductCard must render unit-derived IMEI/serial chips',
);

assert.match(
  source,
  /unitIdentifierChips\.length > 0 \? unitIdentifierChips : specIdentifierChips/,
  'ProductCard must prefer unit identifiers and keep legacy specs as fallback only',
);

assert.match(
  source,
  /unit\.serial_number/,
  'ProductCard must read serial identifiers from unit rows',
);

console.log('product card unit identifiers static checks passed');
