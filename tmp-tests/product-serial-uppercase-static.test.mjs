import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const productSpecifications = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');
const productForm = readFileSync('components/products/ProductForm.tsx', 'utf8');
const pdvSearch = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  productSpecifications,
  /const normalizeSerializedTextInput[\s\S]*toUpperCase\(\)/,
  'ProductSpecifications must normalize serial text fields to uppercase as the user types',
);

assert.match(
  productSpecifications,
  /key === 'serial'[\s\S]*normalizeSerializedTextInput\(key, e\.target\.value\)[\s\S]*setValue\(fieldKey, nextValue/,
  'ProductSpecifications serial field must save uppercase text, independent of typed casing',
);

assert.match(
  productSpecifications,
  /key === 'serial'[\s\S]*uppercase/,
  'ProductSpecifications serial input must visually render uppercase',
);

assert.match(
  productForm,
  /serial:\s*normalizeSerializedTextInput\('serial', overrides\.serial \|\| watch\('specs\.serial'\)/,
  'ProductForm batch item creation must persist uppercase serial identifiers',
);

assert.match(
  pdvSearch,
  /setImeiQuery\(e\.target\.value\.toUpperCase\(\)\)/,
  'PDV IMEI/serial search input must normalize typed text to uppercase',
);

console.log('product serial uppercase static checks passed');
