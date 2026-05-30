import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'components/products/ProductForm.tsx',
  'components/products/entry/components/BatchEntryGrid.tsx',
  'components/products/sections/ProductSpecifications.tsx',
];

for (const file of files) {
  const source = readFileSync(resolve(file), 'utf8');

  assert(
    /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*limit:\s*5000/.test(source),
    `${file} should check unique product specs through active VPS products`,
  );

  assert(
    /product\.specs\?\.\[field\]/.test(source),
    `${file} should preserve dynamic specs-field matching`,
  );

  assert(
    !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
    `${file} must not read products directly from Supabase`,
  );
}

console.log('unique validation active VPS product static checks passed');
