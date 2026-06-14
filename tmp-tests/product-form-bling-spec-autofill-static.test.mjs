import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  /color: link\.specAutofill\.color \|\| batchItem\.color/,
  'vinculo manual do item em massa deve preencher a cor do item'
);

assert.match(
  source,
  /color: link\.specAutofill\.color \|\| item\.color/,
  'auto-link antes de salvar lote deve preservar/preencher cor por item'
);

console.log('product-form-bling-spec-autofill-static ok');
