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

assert.match(
  source,
  /fallbackStoreStockLocation/,
  'ProductCard must fall back to the current stock as store stock when no location distribution exists yet'
);

assert.match(
  source,
  /Loja Principal/,
  'ProductCard fallback stock location must use Loja Principal as the default deposit'
);

assert.match(
  source,
  /Estoque Geral/,
  'ProductCard fallback stock location must use Estoque Geral as the default location'
);

console.log('product card stock location modal static checks passed');
