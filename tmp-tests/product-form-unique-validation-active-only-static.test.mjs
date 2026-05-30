import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

const start = source.indexOf('if (serialList.length > 0) {');
const end = source.indexOf('if (hasSerializedIdentity(mergedData.specs || {}))', start);
assert(start >= 0 && end > start, 'Could not isolate ProductForm serialized uniqueness block');

const block = source.slice(start, end);

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'ProductForm must validate serial/IMEI uniqueness only against active VPS products',
);

assert(
  !/vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'ProductForm must not block recadastro because of inactive/deleted product rows',
);

console.log('ProductForm unique validation ignores inactive/deleted products');
