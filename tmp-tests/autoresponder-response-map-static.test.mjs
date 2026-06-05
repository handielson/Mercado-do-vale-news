import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/autoresponder/response-map.md', 'utf8');

[
  'Fluxo: Entrega Fora De Compra',
  'delivery.awaiting_cep',
  'Fluxo: Busca De Produto',
  'product_search.awaiting_choice',
  'Fluxo: Compra',
  'purchase.awaiting_quantity',
  'Fallback Fora Do Fluxo',
  'Nao consegui identificar certinho',
].forEach((needle) => {
  assert.ok(doc.includes(needle), `response map must include ${needle}`);
});

console.log('autoresponder response map static checks passed');
