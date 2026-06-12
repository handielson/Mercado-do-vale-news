import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  source,
  /const shouldShowStorageField = shouldRenderField\('storage', categoryConfig\.storage\)/,
  'storage selector must be controlled by category config',
);

assert.match(
  source,
  /const shouldShowRamField = shouldRenderField\('ram', categoryConfig\.ram\)/,
  'RAM selector must be controlled by category config',
);

assert.match(
  source,
  /\{shouldShowStorageField && \(/,
  'storage selector must not render when category storage is off',
);

assert.match(
  source,
  /\{shouldShowRamField && \(/,
  'RAM selector must not render when category ram is off',
);

console.log('product specs category-off static checks passed');
