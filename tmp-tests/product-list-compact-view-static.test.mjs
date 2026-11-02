import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lista de produtos (parte 4): visualização "Lista" compacta, padrão no celular sem preferência salva.
const page = fs.readFileSync(new URL('../pages/admin/products/ProductListPage.tsx', import.meta.url), 'utf8');
const list = fs.readFileSync(new URL('../components/products/ProductCompactList.tsx', import.meta.url), 'utf8');

assert.match(page, /type ProductViewMode = 'cards' \| 'families' \| 'compact';/);
assert.match(page, /if \(stored === 'families' \|\| stored === 'compact' \|\| stored === 'cards'\) return stored;/, 'respeita a escolha salva');
assert.match(page, /window\.innerWidth < 768 \? 'compact' : 'cards'/, 'sem escolha salva: celular começa na Lista');
assert.match(page, /handleViewModeChange\('compact'\)\} data-view-compact[\s\S]*<List size=\{16\} \/> Lista/);
assert.match(page, /viewMode === 'compact' \? \(\s*<ProductCompactList[\s\S]*onToggleFamily=\{handleToggleFamily\}/);
assert.doesNotMatch(list, /ProductCard\b/, 'a lista não monta o card completo (sem consultas extras)');
assert.match(list, /loading="lazy"/, 'fotos carregam conforme rola');
assert.match(list, /if \(row\.isFamily\) toggleOpen\(row\.key\);\s*else onEdit\(row\.product\);/, 'toque: família abre variações, produto abre edição');
assert.match(list, /if \(row\.isFamily\) onToggleFamily\(familyProducts, !selected\);/, 'seleção marca a família inteira');

console.log('product list compact view static test passed');
