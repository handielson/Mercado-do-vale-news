import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getCatalogTitle } from '../services/catalogTitle.js';
import { getCatalogFamilyName, generateCatalogGroupKey } from '../services/productGroupingCore.js';

const require = createRequire(import.meta.url);
const Fastify = require('fastify');
const { registerCatalogTitleRoutes } = require('../services/catalogTitleServer.cjs');

test('admin VPS reload preserves saved complement on parent and inherited complement on child', () => {
    const ts = require('typescript');
    const source = readFileSync('hooks/useProducts.ts', 'utf8');
    const ast = ts.createSourceFile('useProducts.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const mapper = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'mapVpsProduct');
    assert.ok(mapper, 'Admin mapper must exist');
    const js = ts.transpileModule(mapper.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const context = { ProductStatus: { ACTIVE: 'active' } };
    vm.runInNewContext(js, context);
    const parentRow = { id: 'parent', name: 'C17 Plus', is_parent: 1, catalog_title_complement: 'Sabor iPhone' };
    const childRow = { id: 'child', name: 'C17 Plus Laranja', parent_id: 'parent', parent_catalog_title_complement: 'Sabor iPhone' };
    const parent = context.mapVpsProduct(parentRow);
    const child = context.mapVpsProduct(childRow);
    assert.equal(parent.catalog_title_complement, 'Sabor iPhone');
    assert.equal(child.parent_catalog_title_complement, 'Sabor iPhone');
    assert.equal(getCatalogTitle(parent.name, parent), 'C17 Plus · Sabor iPhone');
    assert.equal(parent.name, parentRow.name);
    assert.equal(context.mapVpsProduct({ ...parentRow, catalog_title_complement: '' }).catalog_title_complement, '');
    assert.equal(context.mapVpsProduct({ id: 'plain' }).catalog_title_complement, null);
});

test('all variations use only the parent complement without changing identity', () => {
    for (const color of ['Laranja', 'Prata']) {
        const product = {
            name: `C17 Plus ${color}`, parent_id: 'parent', parent_name: 'C17 Plus',
            catalog_title_complement: 'obsolete child text',
            parent_catalog_title_complement: 'Oferta da semana', specs: { color },
        };
        const before = structuredClone(product);
        const key = generateCatalogGroupKey(product);
        assert.equal(getCatalogTitle(getCatalogFamilyName(product), product), 'C17 Plus · Oferta da semana');
        assert.deepEqual(product, before);
        assert.equal(generateCatalogGroupKey(product), key);
        assert.equal(getCatalogFamilyName(product), 'C17 Plus');
    }
});

test('empty parent complement never falls back to stale child data', () => {
    for (const value of [null, undefined, '', '   ']) {
        assert.equal(getCatalogTitle('C17 Plus', {
            parent_id: 'parent', parent_catalog_title_complement: value,
            catalog_title_complement: 'Texto antigo',
        }), 'C17 Plus');
    }
    assert.equal(getCatalogTitle('C17 Plus', { catalog_title_complement: ' Oferta ' }), 'C17 Plus · Oferta');
});

async function fixture(t) {
    const parent = { id: 'parent', is_parent: 1, name: 'C17 Plus', sku: 'C17', price_cost: 20000, catalog_title_complement: null };
    const child = { id: 'child', parent_id: 'parent', name: 'C17 Plus Laranja', stock_quantity: 2 };
    const app = Fastify();
    const calls = [];
    registerCatalogTitleRoutes(app, {
        requireSyncKeyOrAdmin(req, reply, done) {
            if (req.headers.authorization !== 'Bearer test-admin') return reply.code(403).send({ error: 'Forbidden' });
            done();
        },
        pool: { async query(sql, params) {
            calls.push({ sql, params });
            assert.match(sql, /SET catalog_title_complement=\?, updated_at=CURRENT_TIMESTAMP/);
            assert.match(sql, /is_parent=1/);
            if (params[1] !== parent.id) return [{ affectedRows: 0 }];
            parent.catalog_title_complement = params[0];
            return [{ affectedRows: 1 }];
        } },
    });
    t.after(() => app.close());
    const patch = (id, complement, auth = true) => app.inject({
        method: 'PATCH', url: `/products/${id}/catalog-title`, payload: { complement },
        headers: auth ? { authorization: 'Bearer test-admin' } : {},
    });
    return { parent, child, patch, calls };
}

test('save and remove affect only presentation metadata on the parent', async t => {
    const { parent, child, patch } = await fixture(t);
    const before = structuredClone({ parent, child });
    assert.equal((await patch('parent', ' Oferta ')).statusCode, 200);
    assert.equal(parent.catalog_title_complement, 'Oferta');
    assert.equal((await patch('parent', '')).statusCode, 200);
    assert.deepEqual({ parent, child }, before);
});

test('child, invalid values and unauthorized writes are rejected', async t => {
    const { patch, calls } = await fixture(t);
    assert.equal((await patch('child', 'Oferta')).statusCode, 409);
    assert.equal((await patch('parent', 'x'.repeat(121))).statusCode, 400);
    assert.equal((await patch('parent', 123)).statusCode, 400);
    assert.equal((await patch('parent', 'Oferta', false)).statusCode, 403);
    assert.equal(calls.length, 1);
});
