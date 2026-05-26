import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pricing = readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');

assert.match(
  pricing,
  /const desiredProfit = Math\.max\(0, price - cost\);/,
  'each price row must derive the desired profit from the current sale price and cost',
);

assert.match(
  pricing,
  /Quero ganhar \(R\$\)/,
  'price rows must expose a field for the profit amount the seller wants to earn',
);

assert.match(
  pricing,
  /onChange=\{\(val\) => setValue\(row\.key, cost \+ val\)\}/,
  'typing a desired profit must set sale price to cost plus desired profit',
);

assert.match(
  pricing,
  /disabled=\{cost === 0\}/,
  'desired profit input must be disabled until cost is filled',
);

assert.match(
  pricing,
  /Direto ou por lucro/,
  'the UI must make it clear the seller can use either direct price or desired profit',
);

console.log('product pricing desired profit static checks passed');
