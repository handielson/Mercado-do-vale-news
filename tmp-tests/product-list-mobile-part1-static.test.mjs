import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lista de produtos (parte 1): preço/estoque no card fechado e paginação sem cortar no celular.
const card = fs.readFileSync(new URL('../components/products/ProductCard.tsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../pages/admin/products/ProductListPage.tsx', import.meta.url), 'utf8');

const detailsStart = card.indexOf('<div id={detailsId} hidden={!showDetails}');
const summaryAt = card.indexOf('data-card-summary');
assert.ok(summaryAt > 0 && summaryAt < detailsStart, 'resumo (preço/estoque) fica fora dos detalhes recolhidos');
assert.match(card, /getAdminProductCardSummary\(\{\s*\.\.\.product,\s*status: currentStatus,\s*stock_quantity: currentStock,/, 'resumo usa status e estoque atuais do card');
assert.match(page, /data-product-pagination/);
assert.match(page, /<div className="hidden items-center gap-2 sm:flex">\s*<span className="text-sm text-slate-500">Itens por pág:<\/span>/, '"itens por página" só a partir do sm');
assert.match(page, /className="hidden items-center gap-2 sm:flex"\s*onSubmit=|<form\s+className="hidden items-center gap-2 sm:flex"/, '"Ir para" só a partir do sm');
assert.match(page, /aria-label="Página anterior"/);
assert.match(page, /aria-label="Próxima página"/);

console.log('product list mobile part 1 static test passed');
