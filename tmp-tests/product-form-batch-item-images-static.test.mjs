import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

const expectations = [
  /sku\?: string/,
  /eans\?: string\[\]/,
  /bling_id\?: number/,
  /images\?: string\[\]/,
  /handleBatchItemImageUpload/,
  /removeBatchItemImage/,
  /handleBatchItemBlingLink/,
  /updateBatchItemField/,
  /accept="image\/\*"/,
  /item\.images\?\.length/,
  /item\.sku/,
  /item\.eans/,
  /item\.bling_id/,
  /resolveSerializedBatchItemImages/,
];

for (const pattern of expectations) {
  assert.match(source, pattern);
}

assert.match(
  source,
  /itemImages:\s*item\.images[\s\S]*colorImages[\s\S]*fallbackImages:\s*mergedData\.images/,
);

console.log('product-form-batch-item-images static tests passed');
