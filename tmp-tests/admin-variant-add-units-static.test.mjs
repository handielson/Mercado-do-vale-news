import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const detail = readFileSync('pages/admin/products/ProductDetailPage.tsx', 'utf8');

assert.match(store, /admin-variant-add-units-v1/, 'cada variacao da loja tem atalho de admin para incluir pecas');
assert.match(store, /const addUnitsUrl = isAdmin && sib\.id/, 'o atalho so aparece para administrador');
// entrada-atalhos-v1: o atalho abre a Entrada com a variacao fixa (antes: ?tab=inventory&addUnit=1).
assert.match(store, /const addUnitsUrl = isAdmin && sib\.id\s*\?\s*entryAddUnitsPath\(sib\.id\)/, 'o atalho abre a Entrada com a variacao fixa');
assert.doesNotMatch(store, /addUnit=1/, 'a loja nao monta mais o link antigo');
assert.match(store, /\{addUnitsUrl && \(\s*<button/, 'o botao fica fora do botao da variacao (esgotada continua clicavel no atalho)');
assert.match(detail, /get\('tab'\) === 'inventory'/, 'a pagina do produto aceita abrir na aba de estoque');
assert.match(detail, /get\('addUnit'\) === '1'/, 'a pagina do produto ainda reconhece o link antigo');
assert.match(detail, /navigate\(entryAddUnitsPath\(id\)!, \{ replace: true \}\)/, 'link antigo addUnit=1 redireciona para a Entrada');
assert.match(detail, /navigate\(entryAddUnitsPath\(product\.id\)!\)/, '"Adicionar Unidade" abre a Entrada');
assert.doesNotMatch(detail, /<UnitForm\b/, 'formulario embutido saiu da pagina do produto');

console.log('admin variant add units static checks passed');

// pdp-compact-variants-v1: opcoes compactas para o preco aparecer sem rolar.
assert.match(store, /pdp-compact-variants-v1/);
assert.match(store, /className=\{`min-h-9 px-3 py-1\.5 rounded-lg border text-sm font-medium/, 'botoes de cor menores');
assert.doesNotMatch(store, /<div key=\{group\.memoryLabel\} className="rounded-xl border border-slate-200 bg-slate-50\/70 p-3">/, 'cada memoria nao fica mais numa caixa propria');
console.log('pdp compact variants ok');
assert.doesNotMatch(store, /data-variant-inline-price/, 'preco nao se repete ao lado das opcoes (pdp-no-duplicate-price-v1)');
assert.match(store, /pdp-no-duplicate-price-v1/);
console.log('pdp inline price ok');
