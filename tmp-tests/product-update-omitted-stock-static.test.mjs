import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../services/products.ts', import.meta.url), 'utf8');

test('update sem estoque não manda stock_quantity (o servidor mantém o saldo)', () => {
    assert.match(src, /stock_quantity: input\.stock_quantity === undefined \? undefined : \(input\.stock_quantity \|\| 0\)/);
    assert.doesNotMatch(src, /oldProduct\.stock_quantity \?\? 0/);
});

test('Shopee só recebe estoque quando o update trouxe estoque', () => {
    assert.match(src, /shopeeStockChanged = Boolean\(input\.track_inventory && payload\.stock_quantity !== undefined && /);
});

test('PUT /products/:id só concilia estoque quando ele vem no corpo', () => {
    for (const file of ['vps_server.js', 'vps_server.cjs']) {
        const server = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        const start = server.indexOf("fastify.put('/products/:id'");
        const body = server.slice(start, start + 4000);
        assert.match(body, /if \(req\.body\.stock_quantity !== undefined\)/, file);
        assert.doesNotMatch(body.slice(body.indexOf('UPDATE products SET'), body.indexOf('WHERE id=?')), /stock_quantity/, file);
    }
});
