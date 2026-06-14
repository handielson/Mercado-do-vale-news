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
  /setValue\('specs\.ram', link\.specAutofill\.ram,\s*\{ shouldDirty: true, shouldValidate: true \}\);/,
  'vinculo automatico por SKU deve selecionar specs.ram'
);

assert.match(
  source,
  /setValue\('specs\.storage', link\.specAutofill\.storage,\s*\{ shouldDirty: true, shouldValidate: true \}\);/,
  'vinculo automatico por SKU deve selecionar specs.storage'
);

assert.match(
  source,
  /color: link\.specAutofill\.color \|\| batchItem\.color/,
  'vinculo manual do item em massa deve preencher a cor do item'
);

assert.match(
  source,
  /ram: link\.specAutofill\.ram \|\| batchItem\.ram/,
  'vinculo manual do item em massa deve preencher RAM do item'
);

assert.match(
  source,
  /storage: link\.specAutofill\.storage \|\| batchItem\.storage/,
  'vinculo manual do item em massa deve preencher armazenamento do item'
);

assert.match(
  source,
  /color: link\.specAutofill\.color \|\| item\.color/,
  'auto-link antes de salvar lote deve preservar/preencher cor por item'
);

assert.match(
  source,
  /ram: link\.specAutofill\.ram \|\| item\.ram/,
  'auto-link antes de salvar lote deve preservar/preencher RAM por item'
);

assert.match(
  source,
  /storage: link\.specAutofill\.storage \|\| item\.storage/,
  'auto-link antes de salvar lote deve preservar/preencher armazenamento por item'
);

console.log('product-form-bling-spec-autofill-static ok');
