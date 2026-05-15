import assert from 'node:assert/strict';
import fs from 'node:fs';

const combosPage = fs.readFileSync('pages/admin/products/ProductCombosPage.tsx', 'utf8');
const productListPage = fs.readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');
const routes = fs.readFileSync('routes/index.tsx', 'utf8');
const layout = fs.readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(combosPage, /openNewOfferModal/);
assert.match(combosPage, /createOffer/);
assert.match(combosPage, /updateOffer/);
assert.match(combosPage, /offer_type/);
assert.match(combosPage, /calculateOfferStock/);
assert.match(combosPage, /Kit de quantidade/);
assert.match(productListPage, /\/admin\/products\/offers/);
assert.match(routes, /path: "\/admin\/products\/offers"/);
assert.match(layout, /label: 'Ofertas'/);

console.log('product offer admin static checks passed');
