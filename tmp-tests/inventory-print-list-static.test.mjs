import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pagePath = path.join(root, 'pages/admin/inventory/InventoryPrintListPage.tsx');
assert.equal(fs.existsSync(pagePath), true, 'inventory print list page must exist');

const page = read('pages/admin/inventory/InventoryPrintListPage.tsx');
const routes = read('routes/index.tsx');
const layout = read('layouts/AdminLayout.tsx');
const estoque = read('Estoque.md');

assert.match(page, /export function InventoryPrintListPage/, 'page must export InventoryPrintListPage');
assert.match(page, /productService\.searchByEAN/, 'barcode lookup must try EAN first');
assert.match(page, /productService\.search\(/, 'lookup must fallback to product search');
assert.match(page, /window\.open\('', '_blank'\)/, 'print action must open a print window');
assert.match(page, /window\.print\(\)/, 'print markup must trigger browser print');
assert.match(page, /Nome \| Variacao \| SKU \| Codigo de barras EAN/, 'screen must show required printed columns');
assert.match(page, /Caixa\/lote/, 'list must identify caixa/lote');
assert.match(page, /Responsavel/, 'list must identify responsible staff');
assert.match(page, /setItems\(/, 'items must be kept in component state');
assert.doesNotMatch(page, /adjustStockLocation|transferStockLocation|decrement_stock|increment_stock|insert\(/, 'print list must not write or move stock');

assert.match(routes, /InventoryPrintListPage/, 'routes must lazy-load InventoryPrintListPage');
assert.match(routes, /\/admin\/inventory\/print-list/, 'routes must expose print-list route');
assert.match(layout, /\/admin\/inventory\/print-list[\s\S]*Lista de Impressao/, 'admin menu must link the print list');
assert.match(estoque, /Criar lista de impressao para caixa\/separacao/, 'Estoque.md must track print list status');

console.log('inventory print list static checks passed');
