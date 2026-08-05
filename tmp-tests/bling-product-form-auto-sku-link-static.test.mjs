import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/blingService.ts', 'utf8');
const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const section = readFileSync('components/products/sections/BlingLinkSection.tsx', 'utf8');
const basicInfo = readFileSync('components/products/sections/ProductBasicInfo.tsx', 'utf8');

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
  /automaticBlingLookupRef\.current/,
  'Automatic Bling lookup must deduplicate concurrent requests for the same SKU'
);

assert.match(
  form,
  /automaticBlingRequestIdRef\.current === requestId/,
  'Automatic Bling lookup must ignore stale requests after the SKU changes'
);

assert.match(
  form,
  /findBlingLinkBySku\(cleanSku, \{ skipLocalProductLookup: true \}\)/,
  'Automatic Bling lookup must not wait for slow local catalog fallbacks'
);

assert.match(
  form,
  /isBlingReconnectRequired\(error\)[\s\S]*Bling desconectado\. Reconecte a integracao para buscar este SKU\./,
  'Automatic SKU lookup must distinguish an expired Bling connection from a missing SKU'
);

assert.match(
  form,
  /blingLookupError=\{blingLookupError\}/,
  'Product form must expose the Bling lookup failure to the compact status field'
);

assert.match(
  basicInfo,
  /href="\/admin\/settings\/bling"[\s\S]*Reconectar/,
  'Disconnected Bling status must provide a direct reconnect action'
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
  /setValue\('eans', linkEans, \{ shouldDirty: true, shouldValidate: true \}\);/,
  'Automatic SKU link must fill the resolved EAN list when the form has no EANs yet'
);

assert.match(
  form,
  /mergedData\.eans = automaticBlingLink\.eans \|\| \[automaticBlingLink\.ean\];/,
  'Submit payload must include all resolved Bling EANs when they were auto-filled during submit'
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
