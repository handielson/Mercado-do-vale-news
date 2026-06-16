import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /const localProduct = await findLocalProductForBlingLink\(cleanSku,\s*product\.id\);/,
  'findBlingLinkBySku must look for an existing local product linked by SKU/Bling before returning',
);

assert.match(
  source,
  /model_id: localProduct\?\.model_id \|\| null,/,
  'Bling auto-link must expose model_id from the local product when available',
);

assert.match(
  source,
  /model: localProduct\?\.model \|\| null,/,
  'Bling auto-link must expose model name from the local product when available',
);

assert.match(
  source,
  /const resolvedEans = uniqueEans\(\[blingEan,\s*\.\.\.\(localProduct\?\.eans \|\| \[\]\)\]\);/,
  'Bling auto-link must merge Bling GTIN and local product EANs',
);

assert.match(
  source,
  /setValue\('model_id', link\.model_id, \{ shouldDirty: true, shouldValidate: true \}\);/,
  'automatic Bling link must fill model_id into the form',
);

assert.match(
  source,
  /setValue\('model', link\.model, \{ shouldDirty: true, shouldValidate: true \}\);/,
  'automatic Bling link must fill model name into the form',
);

assert.match(
  source,
  /model_id: link\.model_id \|\| item\.model_id,/,
  'batch auto-link must preserve or fill model_id per item',
);

assert.match(
  source,
  /model: link\.model \|\| item\.model,/,
  'batch auto-link must preserve or fill model name per item',
);

console.log('product form Bling model/EAN autofill static checks passed');
