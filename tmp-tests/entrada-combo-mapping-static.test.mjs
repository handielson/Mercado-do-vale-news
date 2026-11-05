import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// GET /products/:id faz SELECT * (devolve is_combo e offer_type); o mapeamento do cliente precisa repassar,
// senão loadFixedVariation (atalho ?variacao=) não enxerga combo/oferta.
test('transformFromDB repassa is_combo e offer_type', () => {
    const src = readFileSync('services/products.ts', 'utf8');
    const body = src.slice(src.indexOf('function transformFromDB'), src.indexOf('async function isSerializedProductCategory'));
    assert.match(body, /is_combo:\s*Number\(row\.is_combo\) === 1/);
    assert.match(body, /offer_type:\s*row\.offer_type \|\| null/);
});

test('GET /products/:id seleciona todas as colunas do produto', () => {
    const src = readFileSync('vps_server.js', 'utf8');
    const at = src.indexOf("fastify.get('/products/:id'");
    assert.ok(at > 0);
    assert.match(src.slice(at, at + 400), /SELECT \*,/);
});
