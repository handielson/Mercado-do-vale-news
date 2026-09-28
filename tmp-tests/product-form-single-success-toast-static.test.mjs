import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /const savedProduct = await onSubmit\(mergedData\);[\s\S]*if \(!initialData\) \{\s*toast\.success\('Produto cadastrado com sucesso!'\);\s*\}\s*onBatchComplete\?\.\(savedProduct \|\| undefined\);/s,
  'ProductForm must only show the single-product creation success toast when creating a new product, so edit flow keeps only the update toast from ProductFormPage.'
);

console.log('ok - ProductForm single-product success toast is create-only');
