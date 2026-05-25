import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const specs = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  specs,
  /onAddToBatchList\?: \(\) => void;/,
  'ProductSpecifications must receive the batch add action as a header prop',
);

assert.match(
  specs,
  /onClick=\{onAddToBatchList\}[\s\S]*Adicionar .* Lista/,
  'ProductSpecifications header must render the Adicionar a Lista button',
);

const specsStart = specs.indexOf('<h3 className="font-semibold text-slate-800 flex items-center gap-2">');
const addIndex = specs.indexOf('Adicionar', specsStart);
const refreshIndex = specs.indexOf('Atualizar Campos', specsStart);
assert.ok(specsStart > 0, 'ProductSpecifications must render a section header');
assert.ok(addIndex > specsStart, 'Add button must be rendered in the specifications header area');
assert.ok(refreshIndex > addIndex, 'Add button must appear before Atualizar Campos in the header actions');

assert.match(
  form,
  /onAddToBatchList=\{!initialData \? handleAddToBatchList : undefined\}/,
  'ProductForm must pass the add-to-list action to ProductSpecifications only for new products',
);

const batchListStart = form.indexOf('Lista para Cadastro em Massa');
const oldButtonIndex = form.indexOf('Adicionar à Lista', batchListStart);
assert.equal(
  oldButtonIndex,
  -1,
  'The lower mass registration list must no longer render a duplicate Adicionar a Lista button',
);

console.log('product form batch add button static checks passed');
