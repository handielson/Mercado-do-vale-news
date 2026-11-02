import assert from 'node:assert/strict';
import fs from 'node:fs';

// Tela "Novo/Editar Modelo" no celular: tela cheia, uma coluna e sem nomes técnicos espremendo os campos.
const modal = fs.readFileSync(new URL('../components/settings/ModelModal.tsx', import.meta.url), 'utf8');
const listInput = fs.readFileSync(new URL('../components/settings/ModelListFieldInput.tsx', import.meta.url), 'utf8');

assert.match(modal, /fixed inset-0 !mt-0 [^"]*p-0 sm:p-6[^"]*" data-model-modal/, 'modal em tela cheia no celular e sem herdar margem do space-y da página');
assert.match(modal, /rounded-none sm:rounded-xl/, 'sem cantos arredondados em tela cheia');
assert.match(modal, /\[&_input\]:text-base[^"]*md:\[&_input\]:text-sm/, 'campos com 16px no celular para o iPhone não dar zoom');
assert.doesNotMatch(modal, /flex-1 flex-shrink-0 whitespace-nowrap px-4/, 'abas não podem ser espremidas no celular');
assert.match(modal, /flex-none md:flex-1 whitespace-nowrap/, 'abas rolam para o lado no celular');
assert.match(modal, /grid grid-cols-1 sm:grid-cols-2 gap-4" data-model-template-fields/, 'campos do template em uma coluna no celular');
assert.doesNotMatch(modal, /<span className="text-slate-[45]00 font-mono( text-xs)?">\(/, 'nome técnico do campo só aparece no computador');
assert.match(modal, /flex flex-col gap-2 sm:flex-row">\s*<input\s+type="text"\s+placeholder="Digite o SKU do pai no Bling"/, 'botão Preencher do Bling não pode sair da tela');
assert.match(listInput, /h-11 w-11 md:h-10 md:w-10/, 'botões + e lápis com toque de 44px no celular');

console.log('model modal mobile static test passed');
