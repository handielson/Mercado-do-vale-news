import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// stock-entry-only-v1 (etapa 6): o "Adicionar à Lista" e a lista de cadastro em massa saíram do formulário.
// Aparelhos (IMEI/serial) entram pela tela Entrada; o formulário cadastra só o catálogo.
const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
const specs = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.doesNotMatch(specs, /onAddToBatchList/, 'ProductSpecifications não recebe mais a ação de lista');
assert.doesNotMatch(specs, /Adicionar à Lista/, 'sem botão "Adicionar à Lista" nas Especificações');
assert.doesNotMatch(form, /onAddToBatchList|handleAddToBatchList/, 'ProductForm não monta a lista de aparelhos');
assert.doesNotMatch(form, /Lista para Cadastro em Massa/, 'a lista de cadastro em massa saiu do formulário');

// Produto novo ou rascunho ainda sem id (rascunho automático) continua sendo cadastro novo.
assert.match(
  form,
  /const isNewRegistration = !initialData\?\.id;/,
  'new registration must mean a new product or an unsaved draft, never an existing product',
);
assert.match(
  form,
  /hideUnitIdentity=\{isNewRegistration \|\| variationDraftMode\}/,
  'no cadastro novo (e nas linhas de família) IMEI/serial não aparecem',
);

console.log('product form batch add button static checks passed');
