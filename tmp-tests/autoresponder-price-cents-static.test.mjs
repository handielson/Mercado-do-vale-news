import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function normalizeAutoresponderPriceValue\(value\)/,
  'expected autoresponder prices to be normalized before display',
);

assert.match(
  source,
  /return amount \/ 100;/,
  'expected VPS price values stored in cents to be converted to BRL',
);

assert.match(
  source,
  /const priceCents = getAutoresponderProductPriceCents\(product\);/,
  'expected installment calculation to reuse the normalized product price in cents',
);

assert.match(
  source,
  /const price = getAutoresponderProductPrice\(product\);/,
  'expected detail replies to use normalized product price',
);

assert.doesNotMatch(
  source,
  /const price = Number\(product\.price_promo \|\| 0\) > 0 \? product\.price_promo : product\.price_retail;/,
  'detail replies must not format raw cent values as BRL',
);

console.log('autoresponder price cents static checks passed');
