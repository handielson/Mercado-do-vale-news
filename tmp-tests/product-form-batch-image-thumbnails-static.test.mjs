import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  form,
  /const currentProductImages = getValues\('images'\) \|\| imagePreviews;/,
  'batch item creation must read the current product images for thumbnail previews',
);

assert.match(
  form,
  /images: currentProductImages,/,
  'new batch items must keep the current images so the list can preview them',
);

assert.match(
  form,
  /\(item\.images\?\.length \|\| 0\) === 0/,
  'batch list must explicitly render a no-image state when an item has no images',
);

assert.match(
  form,
  /Sem imagem/,
  'batch list no-image state must be visible to the user',
);

assert.match(
  form,
  /alt=\{`Imagem \$\{imageIndex \+ 1\} de \$\{item\.sku \|\| item\.serial \|\| 'produto'\}`\}/,
  'batch thumbnails must have descriptive alt text',
);

console.log('product form batch image thumbnail static checks passed');
