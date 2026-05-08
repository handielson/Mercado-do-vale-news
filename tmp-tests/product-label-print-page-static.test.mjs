import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pagePath = 'pages/admin/products/ProductLabelPrintPage.tsx';
assert.equal(existsSync(pagePath), true, 'product label print page must exist');

const page = readFileSync(pagePath, 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const productList = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
const modal = readFileSync('components/products/LabelPrintModal.tsx', 'utf8');

assert.match(page, /LabelPrintModal/, 'label print page must reuse the existing label modal');
assert.match(page, /productService\.searchByEAN/, 'label print page must search barcode/EAN first');
assert.match(page, /productService\.search/, 'label print page must fallback to product search for SKU/name');
assert.match(page, /setSelectedProduct\(matches\[0\]\)/, 'single exact result must open print modal automatically');
assert.match(page, /placeholder=.*EAN.*SKU/s, 'search input must guide barcode/SKU lookup');

assert.match(routes, /ProductLabelPrintPage/, 'routes must lazy load product label print page');
assert.match(routes, /path:\s*["']\/admin\/products\/labels["']/, 'routes must expose /admin/products/labels');

assert.match(layout, /to:\s*['"]\/admin\/products\/labels['"][\s\S]*label:\s*['"]Etiquetas['"]/, 'admin menu must link to label printing page');
assert.match(productList, /navigate\(['"]\/admin\/products\/labels['"]\)/, 'product list tools must link to label printing page');

assert.match(modal, /LABEL_SIZE_STORAGE_KEY/, 'label modal must define a storage key for preferred label size');
assert.match(modal, /localStorage\.getItem\(LABEL_SIZE_STORAGE_KEY\)/, 'label modal must read preferred label size');
assert.match(modal, /localStorage\.setItem\(LABEL_SIZE_STORAGE_KEY,\s*nextSizeId\)/, 'label modal must save preferred label size when changed');

console.log('product label print page static test ok');
