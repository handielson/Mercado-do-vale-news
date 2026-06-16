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
  /model: localProductModelName,/,
  'Bling auto-link must expose model name resolved from the local product when available',
);

assert.match(
  source,
  /const localProductEans = getLocalProductEansForBlingLink\(localProduct\);/,
  'Bling auto-link must normalize local product EAN fields before merging',
);

assert.match(
  source,
  /localProduct\?\.ean/,
  'Bling auto-link must read the raw ean field returned by the VPS products API',
);

assert.match(
  source,
  /localProduct\?\.alternative_eans/,
  'Bling auto-link must read alternative_eans returned by the VPS products API',
);

assert.match(
  source,
  /const resolvedEans = uniqueEans\(\[blingEan,\s*\.\.\.localProductEans\]\);/,
  'Bling auto-link must merge Bling GTIN and normalized local product EANs',
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
  /modelService\.getById\(localProduct\.model_id\)/,
  'Bling auto-link must resolve model name from model_id when the local product row only has model_id',
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
