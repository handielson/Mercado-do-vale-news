import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

// stock-entry-only-v1 (etapa 6): o formulário não cadastra mais aparelho (IMEI/serial), então a exceção
// "serializado pode repetir o EAN do modelo" saiu: EAN repetido sempre bloqueia; o aparelho entra pela Entrada.
assert(
  /const\s+blocksSubmitForDuplicateEAN\s*=\s*isDuplicateEAN\s*;/.test(source),
  'ProductForm blocks submit whenever the EAN already exists',
);
assert(!/isSerializedStockCalculated/.test(source), 'no serialized exception left in the form');

assert(
  // "savingDraft" entrou com o rascunho automático: não salvar o produto enquanto o rascunho grava.
  /disabled=\{isSavingOperation \|\| savingDraft \|\| isCompressing \|\| blocksSubmitForDuplicateEAN \|\| Boolean\(modelFamily\)\}/.test(source),
  'Submit button must use the duplicate EAN blocker',
);

assert(
  /\$\{blocksSubmitForDuplicateEAN\s*\?/.test(source),
  'Submit button styling must be based on the duplicate EAN blocker',
);

assert(
  /\{blocksSubmitForDuplicateEAN \? ['"]/.test(source),
  'Submit button label must show EAN blocked when duplicate EAN blocks submission',
);

console.log('Duplicate EAN blocks product registration');
