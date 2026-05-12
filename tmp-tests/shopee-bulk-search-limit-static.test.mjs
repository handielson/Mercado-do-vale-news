import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.doesNotMatch(
  page,
  /getProducts\(\{\s*limit:\s*500,\s*status:\s*'all'/,
  'Shopee bulk search must not be limited to the first 500 local products',
);

assert.match(
  page,
  /getProducts\(\{\s*limit:\s*5000,\s*status:\s*'all',\s*noCache:\s*true\s*\}\)/,
  'Shopee product loading should request a broad catalog so bulk search can find products beyond the first page',
);

console.log('shopee bulk search limit static check passed');
