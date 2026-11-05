import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// stock-entry-only-v1 (etapa 6): o formulário não cria mais unidade (IMEI/serial) nem estoque.
// Antes: produto base + unitService.create. Agora: o cadastro novo tira IMEI/serial dos specs,
// grava estoque 0 e oferece "Dar entrada no estoque" (tela Entrada).
const form = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.doesNotMatch(form, /unitService/, 'ProductForm não importa nem chama o serviço de unidades');
assert.doesNotMatch(form, /groupSerializedBatchItemsForUnits|UnitStatus\.AVAILABLE/, 'sem agrupamento em produto base + unidades');
assert.match(form, /const isNewRegistration = !initialData \|\| Boolean\(initialDraft && !initialData.id\);/, 'Resumed drafts without a product ID remain new registrations');

assert.match(
  form,
  /if \(isNewRegistration\) \{\s*mergedData\.specs = stripSerializedIdentityFromSpecs\(mergedData\.specs \|\| \{\}\);\s*mergedData\.stock_quantity = 0;\s*\}/,
  'cadastro novo: IMEI/serial não ficam nos specs do produto e o estoque nasce 0',
);
assert.match(
  form,
  /function stripSerializedIdentityFromSpecs\(specs: Record<string, any> = \{\}\) \{\s*const \{\s*imei1: _imei1,\s*imei2: _imei2,\s*serial: _serial,\s*serial_number: _serialNumber,/,
  'a limpeza tira IMEI 1, IMEI 2, serial e serial_number',
);

// Produto único continua salvando um produto só, pelo onSubmit (ou pelo checkpoint de nova tentativa).
assert.match(form, /const savedProduct = !initialData\?\.id && singleSaveCheckpoint\.current\?\.id[\s\S]*: await onSubmit\(mergedData\) as Product \| undefined;/);

console.log('product form serialized units static checks passed');
