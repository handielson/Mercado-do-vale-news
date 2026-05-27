import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

const start = source.indexOf('if (serialList.length > 0) {');
const end = source.indexOf('if (hasSerializedIdentity(mergedData.specs || {}))', start);
assert(start >= 0 && end > start, 'Could not isolate ProductForm serialized uniqueness block');

const block = source.slice(start, end);

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'ProductForm should validate serial/IMEI uniqueness against VPS products',
);

assert(
  /product\.specs\?\.\[key\]/.test(block) && /product\.specs\?\.\[field\]/.test(block),
  'ProductForm should preserve dynamic specs-field checks for batch and single product flows',
);

assert(
  !/\.from\('products'\)[\s\S]{0,220}\.select\('id'\)/.test(block),
  'ProductForm must not read product uniqueness directly from Supabase',
);

console.log('ProductForm unique validation reads products from VPS');
