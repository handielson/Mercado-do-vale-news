import assert from 'node:assert/strict';
import { filterBySelectedCategories } from '../services/catalogFiltering';

const products = [
    { sku: 'RC718256B', category_id: 'smartphones' },
    { sku: 'CABO-USB', category_id: 'cabos' },
    { sku: 'SEM-CAT', category_id: null },
];

assert.deepEqual(
    filterBySelectedCategories(products, ['smartphones']).map(product => product.sku),
    ['RC718256B'],
    'search results must keep only products from the selected category',
);

assert.deepEqual(
    filterBySelectedCategories(products, []).map(product => product.sku),
    ['RC718256B', 'CABO-USB', 'SEM-CAT'],
    'empty category filters must preserve all products',
);

console.log('catalog category filter regression ok');
