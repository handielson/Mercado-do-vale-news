import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');
const formSource = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /const focusSerializedEntryStart\s*=\s*\(\)\s*=>/,
  'ProductSpecifications must define a helper to return the continuous entry flow to IMEI 1.',
);

const genericEnterBlock = source.match(/if \(shouldAddSerializedFieldToBatchOnEnter\([\s\S]*?return;\s*\}/)?.[0] || '';

assert.ok(
  genericEnterBlock.includes('onAddToBatchList?.({ [key]: val });'),
  'Enter on serial must still add the item to the batch list.',
);

assert.ok(
  genericEnterBlock.includes('focusSerializedEntryStart();'),
  'After adding from serial, focus must return to IMEI 1 for uninterrupted scanning.',
);

assert.match(
  formSource,
  /setValue\('specs\.imei1', ''[\s\S]*setValue\('specs\.imei2', ''[\s\S]*setValue\('specs\.serial', ''/,
  'The batch add handler must clear serialized fields before the next scan cycle.',
);

console.log('product specifications serial enter focus static checks passed');
