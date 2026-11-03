import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const detail = readFileSync('pages/admin/products/ProductDetailPage.tsx', 'utf8');

assert.match(store, /admin-variant-add-units-v1/, 'cada variacao da loja tem atalho de admin para incluir pecas');
assert.match(store, /const addUnitsUrl = isAdmin && sib\.id/, 'o atalho so aparece para administrador');
assert.match(store, /\?tab=inventory&addUnit=1/, 'o atalho abre o estoque da variacao com o formulario aberto');
assert.match(store, /\{addUnitsUrl && \(\s*<button/, 'o botao fica fora do botao da variacao (esgotada continua clicavel no atalho)');
assert.match(detail, /get\('tab'\) === 'inventory'/, 'a pagina do produto aceita abrir na aba de estoque');
assert.match(detail, /useState\(requestedAddUnit\)/, 'a pagina do produto abre "Adicionar Unidade" pelo atalho');

console.log('admin variant add units static checks passed');

// pdp-compact-variants-v1: opcoes compactas para o preco aparecer sem rolar.
assert.match(store, /pdp-compact-variants-v1/);
assert.match(store, /className=\{`min-h-9 px-3 py-1\.5 rounded-lg border text-sm font-medium/, 'botoes de cor menores');
assert.doesNotMatch(store, /<div key=\{group\.memoryLabel\} className="rounded-xl border border-slate-200 bg-slate-50\/70 p-3">/, 'cada memoria nao fica mais numa caixa propria');
console.log('pdp compact variants ok');
assert.match(store, /data-variant-inline-price/, 'preco da variacao escolhida aparece junto das opcoes');
console.log('pdp inline price ok');
