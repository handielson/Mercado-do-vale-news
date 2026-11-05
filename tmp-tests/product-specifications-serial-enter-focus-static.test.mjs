import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// stock-entry-only-v1 (etapa 6): Enter no serial não adiciona mais à lista em massa (a lista saiu do
// formulário; aparelhos entram pela tela Entrada). Enter continua levando ao próximo campo.
const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.doesNotMatch(source, /shouldAddSerializedFieldToBatchOnEnter|onAddToBatchList|focusSerializedEntryStart/,
  'ProductSpecifications no longer adds serialized fields to a batch list on Enter.');

const enterBlock = source.match(/if \(e\.key === 'Enter'\) \{[\s\S]*?nextInput\.focus\(\);\s*\}/)?.[0] || '';
assert.ok(enterBlock.includes('e.preventDefault();'), 'Enter must not submit the form.');
assert.ok(enterBlock.includes('const currentIndex = inputs.indexOf(e.currentTarget);'), 'Enter moves focus to the next field.');

console.log('product specifications serial enter focus static checks passed');
