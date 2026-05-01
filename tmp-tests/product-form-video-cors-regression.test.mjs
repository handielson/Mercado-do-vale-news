import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /vpsApiService\.checkVideoBySku/,
  'ProductForm should verify videos through vpsApiService instead of direct CDN HEAD requests'
);

assert.doesNotMatch(
  source,
  /fetch\(\s*candidateUrl/,
  'ProductForm must not fetch the video CDN URL directly from the browser'
);

console.log('product form video CORS regression ok');
