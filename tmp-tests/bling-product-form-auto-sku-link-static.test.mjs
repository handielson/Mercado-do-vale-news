import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/blingService.ts', 'utf8');
const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const section = readFileSync('components/products/sections/BlingLinkSection.tsx', 'utf8');

assert.match(
  service,
  /export async function findBlingProductByExactSku\(sku: string\): Promise<BlingProduct \| null>/,
  'Bling service must expose an exact SKU lookup helper'
);

assert.match(
  service,
  /product\.codigo\)\.trim\(\)\.toLowerCase\(\) === normalizedSku/,
  'Exact SKU lookup must compare normalized codigo values instead of accepting fuzzy search results'
);

assert.match(
  form,
  /findBlingProductByExactSku/,
  'Product form must use the exact SKU lookup helper'
);

assert.match(
  form,
  /resolveAutomaticBlingLink\(mergedData\.sku\)/,
  'Product submit must resolve the Bling link from SKU before persisting'
);

assert.match(
  form,
  /mergedData\.bling_id = automaticBlingLink\.id;/,
  'Automatic Bling link must be included in the submitted payload'
);

assert.match(
  form,
  /const blingEan = String\(product\.gtin \|\| ''\)\.trim\(\);/,
  'Automatic SKU link must read the Bling GTIN/EAN'
);

assert.match(
  service,
  /const detailedProduct = await fetchBlingProductDetail\(exactProduct\.id\);/,
  'Exact SKU lookup must hydrate the matched Bling product detail before returning it'
);

assert.match(
  service,
  /return detailedProduct \|\| exactProduct;/,
  'Exact SKU lookup must fall back to the search result when Bling detail is unavailable'
);

assert.match(
  form,
  /setValue\('eans', \[blingEan\], \{ shouldDirty: true, shouldValidate: true \}\);/,
  'Automatic SKU link must fill the first EAN when the form has no EANs yet'
);

assert.match(
  form,
  /mergedData\.eans = \[automaticBlingLink\.ean\];/,
  'Submit payload must include the Bling EAN when it was auto-filled during submit'
);

assert.match(
  section,
  /Alterar/,
  'Linked Bling section must expose an explicit alter option'
);

assert.match(
  section,
  /Vinculado automaticamente pelo SKU/,
  'Bling section must communicate the automatic SKU link behavior'
);

console.log('bling product form auto SKU link static checks ok');
