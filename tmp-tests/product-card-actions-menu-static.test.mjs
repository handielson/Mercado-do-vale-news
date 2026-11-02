import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lista de produtos (parte 3): no celular as ações secundárias do card ficam no menu "⋯".
const card = fs.readFileSync(new URL('../components/products/ProductCard.tsx', import.meta.url), 'utf8');
const menu = fs.readFileSync(new URL('../components/products/ProductCardActionsMenu.tsx', import.meta.url), 'utf8');

assert.match(card, /<ProductCardActionsMenu title=\{product\.name\} actions=\{mobileCardActions\} \/>/);
for (const key of ['copy-name', 'copy-sku', 'print', 'stock-locations', 'history', 'tags', 'model', 'bling-sync', 'catalog-visibility', 'status', 'delete']) {
  assert.match(card, new RegExp(`key: '${key}'`), `menu tem a ação ${key}`);
}
assert.match(card, /key: 'delete', label: 'Excluir produto', danger: true/, 'Excluir separado, em vermelho');
assert.match(card, /onSelect: \(\) => onDelete\(product\)/, 'Excluir passa pela mesma confirmação da lista');
assert.equal((card.match(/max-md:hidden/g) || []).length, 11, 'os 11 ícones secundários somem só no celular');
assert.match(card, /isHiddenFromCatalog \? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-sky-50 max-md:hidden'/, 'olho fica visível no celular quando o produto está oculto');
assert.match(menu, /data-card-actions-toggle[\s\S]*md:hidden/, 'botão ⋯ só no celular');
assert.match(menu, /danger\.length > 0 && \(\s*<div className="mt-3 space-y-0\.5 border-t/, 'ações perigosas abaixo de uma linha separadora');
assert.match(menu, /min-h-\[48px\]/, 'itens com 48px');
assert.match(menu, /event\.stopPropagation\(\); setOpen\(false\); \}/, 'fundo fecha sem marcar o card');

console.log('product card actions menu static test passed');
