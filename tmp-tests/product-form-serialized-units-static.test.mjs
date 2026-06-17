import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  form,
  /import \{ unitService \} from '..\/..\/services\/units';/,
  'ProductForm must use the VPS unit service for serialized smartphone batch registration',
);

assert.match(
  form,
  /function groupSerializedBatchItemsForUnits\(items: ProductInput\[\]\)/,
  'ProductForm must group serialized batch rows into base products plus units',
);

assert.match(
  form,
  /plannedItems\.push\(\{ \.\.\.batchPlan\.items\[index\], images: itemImages \}\);/,
  'ProductForm must preserve resolved batch images before grouped save',
);

assert.match(
  form,
  /const groupedBatch = groupSerializedBatchItemsForUnits\(plannedItems\);/,
  'ProductForm must create grouped base-product batches before saving',
);

assert.match(
  form,
  /await unitService\.create\(\{[\s\S]*product_id: savedProduct\.id[\s\S]*imei_1: specs\.imei1[\s\S]*status: UnitStatus\.AVAILABLE/s,
  'ProductForm must create available serialized units for IMEI/serial rows',
);

assert.match(
  form,
  /const singleSerializedIdentity = hasSerializedIdentity\(mergedData\.specs \|\| \{\}\)[\s\S]*const singleSerializedSpecs = singleSerializedIdentity[\s\S]*delete mergedData\.specs\.serial[\s\S]*delete mergedData\.specs\.imei1[\s\S]*delete mergedData\.specs\.imei2/s,
  'ProductForm single-product save must move serial/IMEI out of product specs before saving the base product',
);

assert.match(
  form,
  /if \(!initialData && singleSerializedIdentity\) \{[\s\S]*await unitService\.create\(\{[\s\S]*product_id: savedProduct\.id[\s\S]*serial_number: singleSerializedSpecs\?\.serial[\s\S]*status: UnitStatus\.AVAILABLE/s,
  'ProductForm single-product save must create an available unit for the extracted serial/IMEI',
);

assert.doesNotMatch(
  form,
  /const itemData = \{ \.\.\.batchPlan\.items\[index\], images: itemImages \};[\s\S]*await onSubmit\(itemData\);/,
  'ProductForm must not save each serialized row as a standalone product',
);

console.log('product form serialized units static checks passed');
