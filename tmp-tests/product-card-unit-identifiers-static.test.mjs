import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

assert.match(
  source,
  /unitService\.listByProduct\(product\.id\)/,
  'ProductCard must load serialized units for products whose identifiers live outside product.specs',
);

assert.match(
  source,
  /unitIdentifierChips/,
  'ProductCard must render unit-derived IMEI/serial chips',
);

assert.match(
  source,
  /hasSpecIdentifiers/,
  'ProductCard must keep legacy specs identifiers as a fallback only',
);

assert.match(
  source,
  /unit\.serial_number/,
  'ProductCard must read serial identifiers from unit rows',
);

console.log('product card unit identifiers static checks passed');
