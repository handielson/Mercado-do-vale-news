import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveExistingProductImages } from '../components/products/blingSkuExistingImages.js';

assert.deepEqual(
  resolveExistingProductImages({
    images: '["https://cdn.example.com/amarelo-1.jpg", "https://cdn.example.com/amarelo-2.jpg"]',
    image_url: 'https://cdn.example.com/amarelo-1.jpg',
  }),
  [
    'https://cdn.example.com/amarelo-1.jpg',
    'https://cdn.example.com/amarelo-2.jpg',
  ],
);

assert.deepEqual(
  resolveExistingProductImages({
    images: [],
    product_images: ['https://cdn.example.com/produto.jpg'],
    custom_images: ['https://cdn.example.com/custom.jpg'],
  }),
  [
    'https://cdn.example.com/produto.jpg',
    'https://cdn.example.com/custom.jpg',
  ],
);

assert.equal(resolveExistingProductImages({ images: [] }).length, 0);

const productForm = await readFile(new URL('../components/products/ProductForm.tsx', import.meta.url), 'utf8');
assert.match(productForm, /images: resolveExistingProductImages\(localProduct\)/);
assert.match(productForm, /setValue\('images', linkImages/);
assert.match(productForm, /setImagePreviews\(linkImages\)/);

console.log('bling SKU existing images regression: ok');
