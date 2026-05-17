import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

assert.match(
  source,
  /stockLocationService\.getProductStockDistribution\(product\.id\)/,
  'ProductCard must load the product stock distribution when the location modal is opened'
);

assert.match(
  source,
  /setIsStockLocationModalOpen\(true\)/,
  'ProductCard must expose a button that opens the stock location modal'
);

assert.match(
  source,
  /Onde esta no estoque/,
  'ProductCard modal must clearly describe where the product is in stock'
);

assert.match(
  source,
  /Depósito|Deposito/,
  'ProductCard stock modal must show deposit information'
);

assert.match(
  source,
  /Dispon[ií]vel|Disponivel/,
  'ProductCard stock modal must show available quantity per location'
);

console.log('product card stock location modal static checks passed');
