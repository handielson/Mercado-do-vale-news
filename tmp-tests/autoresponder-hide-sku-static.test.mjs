import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.doesNotMatch(
  source,
  /`SKU: \$\{[^`]+`/,
  'autoresponder customer replies must not include SKU lines',
);

assert.match(
  source,
  /name LIKE \? OR sku LIKE \?/,
  'autoresponder search should still be able to find products by SKU internally',
);

console.log('autoresponder hide sku static checks passed');
