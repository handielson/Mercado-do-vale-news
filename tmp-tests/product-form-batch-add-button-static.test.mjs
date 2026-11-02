import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const specs = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  specs,
  /onAddToBatchList\?: \(overrides\?: Record<string, string>\) => void;/,
  'ProductSpecifications must receive the batch add action and support serialized field overrides',
);

assert.match(
  specs,
  /onClick=\{\(\) => onAddToBatchList\(\)\}[\s\S]*Adicionar .* Lista/,
  'ProductSpecifications header must render the Adicionar a Lista button',
);

const specsStart = specs.indexOf('<h3 className="font-semibold text-slate-800 flex items-center gap-2">');
const addIndex = specs.indexOf('Adicionar', specsStart);
const refreshIndex = specs.indexOf('Atualizar Campos', specsStart);
assert.ok(specsStart > 0, 'ProductSpecifications must render a section header');
assert.ok(addIndex > specsStart, 'Add button must be rendered in the specifications header area');
assert.ok(refreshIndex > addIndex, 'Add button must appear before Atualizar Campos in the header actions');

// Produto novo ou rascunho ainda sem id (rascunho automático) continua sendo cadastro novo.
assert.match(
  form,
  /const isNewRegistration = !initialData \|\| Boolean\(initialDraft && !initialData\.id\);/,
  'new registration must mean a new product or an unsaved draft, never an existing product',
);
assert.match(
  form,
  /onAddToBatchList=\{isNewRegistration \? handleAddToBatchList : undefined\}/,
  'ProductForm must pass the add-to-list action to ProductSpecifications only for new products',
);

// Só um botão "Adicionar à Lista": o do topo das Especificações (pedido do usuário em 02/11/2026).
const batchListStart = form.indexOf('Lista para Cadastro em Massa');
assert.ok(batchListStart > 0, 'mass registration list must exist');
assert.equal(
  form.indexOf('Adicionar à Lista', batchListStart),
  -1,
  'The lower mass registration list must no longer render a duplicate Adicionar a Lista button',
);

console.log('product form batch add button static checks passed');
