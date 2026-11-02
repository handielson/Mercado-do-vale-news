import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lista de produtos (parte 2): topo enxuto no celular. Computador continua igual.
const page = fs.readFileSync(new URL('../pages/admin/products/ProductListPage.tsx', import.meta.url), 'utf8');
const filters = fs.readFileSync(new URL('../components/products/ProductFilters.tsx', import.meta.url), 'utf8');

assert.match(page, /data-more-actions-toggle[\s\S]*md:hidden/, 'atalhos atrás de "Mais ações" no celular');
assert.match(page, /className=\{`\$\{showMoreActions \? 'grid' : 'hidden'\} gap-3 md:grid xl:grid-cols-3`\}/, 'atalhos sempre visíveis no computador');
assert.match(page, /<span className="hidden sm:inline">\{selectionMode \? 'Cancelar seleção' : 'Selecionar'\}<\/span>/, 'Selecionar vira ícone no celular');
assert.match(page, /aria-label="Atualizar"/);
assert.match(filters, /data-mobile-filters-toggle[\s\S]*Filtros\{activeFilterCount > 0 \? ` \(\$\{activeFilterCount\}\)` : ''\}/, 'botão Filtros mostra quantos estão ativos');
assert.match(filters, /const extraFilterClass = mobileFiltersOpen \? '' : 'hidden sm:block';/, 'filtros extras escondidos só no celular');
assert.equal((filters.match(/\$\{extraFilterClass\}/g) || []).length >= 9, true, 'todos os filtros extras (menos a busca) usam o recolhimento');
assert.match(filters, /<label className=\{`\$\{cardClass\} relative sm:col-span-2`\}>\s*<span className=\{labelClass\}>Buscar produto<\/span>/, 'busca sempre visível');

console.log('product list mobile part 2 static test passed');
