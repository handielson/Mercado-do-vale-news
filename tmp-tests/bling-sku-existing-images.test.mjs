import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveExistingProductImages, resolveSiblingProductImages } from '../components/products/blingSkuExistingImages.js';

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

assert.deepEqual(
  resolveSiblingProductImages([
    { id: 'same-product', specs: { color: 'Amarelo' }, images: [] },
    { id: 'green', specs: { color: 'Verde' }, images: ['https://cdn.example.com/verde.jpg'] },
    { id: 'yellow', specs: { color: 'amarelo' }, images: ['https://cdn.example.com/amarelo.jpg'] },
  ], {
    id: 'same-product',
    specs: { color: 'Amárelo' },
  }),
  ['https://cdn.example.com/amarelo.jpg'],
);

const productForm = await readFile(new URL('../components/products/ProductForm.tsx', import.meta.url), 'utf8');
assert.match(productForm, /resolveLocalCatalogImagesForBlingLink/);
assert.match(productForm, /vpsApiService\.getProductById\(localProduct\.id, true\)/);
assert.match(productForm, /resolveExistingProductImages\(catalogProduct\)/);
assert.match(productForm, /hydrateExistingLocalProductImagesBySku/);
assert.match(productForm, /await hydrateExistingLocalProductImagesBySku\(cleanSku\)/);
assert.match(productForm, /search: sku/);
assert.match(productForm, /exactSearchSku/);
assert.match(productForm, /getModelImageWithCache\(modelId, colorName \|\| undefined\)/);
assert.match(productForm, /resolveSiblingProductImages\(siblingProducts/);
assert.match(productForm, /setValue\('images', linkImages/);
assert.match(productForm, /setImagePreviews\(linkImages\)/);

console.log('bling SKU existing images regression: ok');
