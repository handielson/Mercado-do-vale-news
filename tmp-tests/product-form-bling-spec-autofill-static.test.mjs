import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// stock-entry-only-v1 (etapa 6): a lista de cadastro em massa saiu do formulário; as checagens do vínculo Bling
// por item da lista saíram com ela. A trava fica em tmp-tests/stock-entry-only-static.test.mjs.

const source = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  /import \{ getBlingSkuSpecAutofill \} from '\.\/blingSkuSpecAutofill\.js';/,
  'ProductForm deve importar o helper pequeno de specs do Bling'
);

assert.match(
  source,
  /const specAutofill = getBlingSkuSpecAutofill\(\{ product, colors \}\);/,
  'findBlingLinkBySku deve enriquecer o retorno com specs do Bling'
);

assert.match(
  source,
  /setValue\('specs\.color', link\.specAutofill\.color,\s*\{ shouldDirty: true, shouldValidate: true \}\);/,
  'vinculo automatico por SKU deve selecionar specs.color'
);

assert.match(
  source,
  /setValue\('specs\.ram', link\.specAutofill\.ram,\s*\{ shouldDirty: true, shouldValidate: true \}\);/,
  'vinculo automatico por SKU deve selecionar specs.ram'
);

assert.match(
  source,
  /setValue\('specs\.storage', link\.specAutofill\.storage,\s*\{ shouldDirty: true, shouldValidate: true \}\);/,
  'vinculo automatico por SKU deve selecionar specs.storage'
);

console.log('product-form-bling-spec-autofill-static ok');
