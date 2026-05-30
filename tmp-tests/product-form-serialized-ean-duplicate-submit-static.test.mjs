import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

assert(
  /const\s+blocksSubmitForDuplicateEAN\s*=\s*isDuplicateEAN\s*&&\s*!isSerializedStockCalculated\s*;/.test(source),
  'ProductForm must allow serialized IMEI/serial products to submit even when the model EAN already exists',
);

assert(
  /disabled=\{isLoading \|\| isCompressing \|\| blocksSubmitForDuplicateEAN\}/.test(source),
  'Submit button must use the serialized-aware duplicate EAN blocker',
);

assert(
  /\$\{blocksSubmitForDuplicateEAN\s*\?/.test(source),
  'Submit button styling must be based on the serialized-aware duplicate EAN blocker',
);

assert(
  /\{blocksSubmitForDuplicateEAN \? ['"]/.test(source),
  'Submit button label must only show EAN blocked when duplicate EAN actually blocks submission',
);

console.log('Serialized products are not blocked by repeated model EAN on submit');
