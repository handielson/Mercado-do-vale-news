import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function pickFirstAutoresponderProductImage\(\.\.\.values\)/,
  'expected a reusable first-image picker',
);

assert.match(
  source,
  /function isAutoresponderUsedProduct\(product\)/,
  'expected used-product detection before image priority',
);

assert.match(
  source,
  /condition/,
  'expected image fallback to inspect product condition',
);

assert.match(
  source,
  /model_color_images/,
  'expected new products to support model_color_images fallback',
);

assert.match(
  source,
  /modelColorImages/,
  'expected camelCase model color image payload fallback',
);

assert.match(
  source,
  /custom_images/,
  'expected custom/used product image fallback',
);

assert.match(
  source,
  /product_images/,
  'expected product_images fallback',
);

assert.match(
  source,
  /if \(isUsedProduct\)/,
  'expected used products to prioritize product image arrays',
);

assert.match(
  source,
  /return pickFirstAutoresponderProductImage\(/,
  'expected main image helper to use first-image picker',
);

console.log('autoresponder product main image fallback static checks passed');
