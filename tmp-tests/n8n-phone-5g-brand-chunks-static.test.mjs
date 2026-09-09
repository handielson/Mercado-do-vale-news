import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  detectPhone5gFilter,
  hasConfirmed5g,
  filterRowsBy5g,
  buildBrandSafeChunks,
} = require('./n8n-fix-phone-5g-and-brand-chunks.cjs');

assert.equal(detectPhone5gFilter('Quais celulares 5G?'), '5g');
assert.equal(detectPhone5gFilter('somente 5g', { activeSmartphoneCatalog: true }), '5g');
assert.equal(detectPhone5gFilter('Realme C85 5G', { salesProductIntent: true }), '5g');
assert.equal(detectPhone5gFilter('Wi-Fi 5 GHz'), '');
assert.equal(detectPhone5gFilter('roteador 5G'), '');
assert.equal(detectPhone5gFilter('celular com 5 GB de RAM'), '');
assert.equal(detectPhone5gFilter('celular com 5 G de RAM'), '');

const rows = [
  { id: 'confirmed', name: 'Modelo Pro', specs: { rede_operadora: '5G / 4G / 3G' } },
  { id: 'explicit', name: 'Modelo 5G', specs: { '5g': 'Sim' } },
  { id: 'four', name: 'Modelo 4G', specs: { rede_operadora: '4G LTE' } },
  { id: 'unknown', name: 'Modelo 5G', specs: { rede_operadora: 'Consulte' } },
  { id: 'conflict', name: 'Modelo 4G', specs: { rede_operadora: '5G' } },
];
assert.equal(hasConfirmed5g(rows[0]), true);
assert.equal(hasConfirmed5g(rows[1]), true);
assert.equal(hasConfirmed5g(rows[2]), false);
assert.equal(hasConfirmed5g(rows[3]), false);
assert.equal(hasConfirmed5g(rows[4]), false);
assert.deepEqual(filterRowsBy5g(rows).map((row) => row.id), ['confirmed', 'explicit']);

const products = [
  ...Array.from({ length: 4 }, (_, index) => ({ brand: 'Xiaomi', id: `x${index + 1}` })),
  ...Array.from({ length: 7 }, (_, index) => ({ brand: 'POCO', id: `p${index + 1}` })),
  { brand: 'Realme', id: 'r1' },
];
const chunks = buildBrandSafeChunks(products, (product) => product.brand);
assert.deepEqual(chunks.map((chunk) => [chunk.brand, chunk.items.length]), [
  ['Xiaomi', 3], ['Xiaomi', 1],
  ['POCO', 3], ['POCO', 3], ['POCO', 1],
  ['Realme', 1],
]);
assert.deepEqual(chunks.flatMap((chunk) => chunk.items.map((item) => item.id)), products.map((item) => item.id));
assert.ok(chunks.every((chunk) => chunk.items.length <= 3));
assert.ok(chunks.every((chunk) => new Set(chunk.items.map((item) => item.brand)).size === 1));

console.log('n8n phone 5G and brand-safe chunk checks passed');
