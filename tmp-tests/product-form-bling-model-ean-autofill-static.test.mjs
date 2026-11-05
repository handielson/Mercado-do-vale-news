import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// stock-entry-only-v1 (etapa 6): a lista de cadastro em massa saiu do formulário; as checagens do vínculo Bling
// por item da lista saíram com ela. A trava fica em tmp-tests/stock-entry-only-static.test.mjs.

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /const localProduct = options\.skipLocalProductLookup\s*\?\s*null\s*:\s*await findLocalProductForBlingLink\(cleanSku,\s*product\.id\);/,
  'findBlingLinkBySku must look for an existing local product linked by SKU/Bling before returning',
);

// v1.2.209 (05/08/2026): o vínculo automático ao digitar o SKU pula a busca local para não travar
// (as imagens locais vêm por hydrateExistingLocalProductImagesBySku); o vínculo manual faz a busca completa.
assert.match(source, /hydrateExistingLocalProductImagesBySku\(cleanSku\)[\s\S]{0,400}findBlingLinkBySku\(cleanSku, \{ skipLocalProductLookup: true \}\)/, 'automatic SKU link skips the slow local lookup and hydrates images separately');

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
  /const hydrateExistingBlingLinkFields = async \(\) =>/,
  'Product form must hydrate EAN/model fields when a Bling link already exists',
);

assert.match(
  source,
  /if \(blingId\) \{\s*hydrateExistingBlingLinkFields\(\);\s*return;\s*\}/s,
  'Existing Bling links must not skip EAN/model hydration in the form effect',
);

assert.match(
  source,
  /: await hydrateExistingBlingLinkFields\(\);/,
  'Saving an already-linked Bling product must still hydrate EAN/model into the payload',
);

console.log('product form Bling model/EAN autofill static checks passed');
