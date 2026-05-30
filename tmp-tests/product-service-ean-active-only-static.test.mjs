import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/products.ts'), 'utf8');

const getByEanStart = source.indexOf('async function getByEan');
const searchByEanStart = source.indexOf('async function searchByEAN');
const listChildrenStart = source.indexOf('async function listChildren', searchByEanStart);
assert(getByEanStart >= 0, 'Could not find getByEan');
assert(searchByEanStart > getByEanStart, 'Could not find searchByEAN');
assert(listChildrenStart > searchByEanStart, 'Could not find listChildren after searchByEAN');

const getByEanBlock = source.slice(getByEanStart, searchByEanStart);
const searchByEanBlock = source.slice(searchByEanStart, listChildrenStart);

assert(
  /isActiveProductForCatalog/.test(source),
  'productService should have an active-product predicate for EAN lookups',
);

assert(
  /\.filter\(isActiveProductForCatalog\)/.test(searchByEanBlock),
  'searchByEAN must ignore inactive products returned by /products/by-ean',
);

assert(
  /\.map\(transformFromDB\)[\s\S]*\.find\(isActiveProductForCatalog\)/.test(getByEanBlock),
  'getByEan must return only an active product so inactive rows do not block recadastro',
);

console.log('productService EAN lookups ignore inactive products');
