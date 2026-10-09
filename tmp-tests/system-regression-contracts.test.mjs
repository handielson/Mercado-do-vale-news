import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { applyCatalogTitleUpdate, CATALOG_TITLE_UPDATED_EVENT } from '../services/catalogTitle.js';

// Execute production functions in memory. No browser, credentials, network or DB.
function source(path, kind = ts.ScriptKind.TS) {
    return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}
function find(ast, predicate) {
    let match;
    function visit(node) {
        if (match) return;
        if (predicate(node)) { match = node; return; }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(match, 'Production behavior must exist; update the harness if it moves');
    return match.getText(ast);
}
function execute(code, dependencies = {}) {
    const context = vm.createContext({ exports: {}, ...dependencies });
    const js = ts.transpileModule(code, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInContext(js, context, { timeout: 2000 });
    return context;
}

const hook = source('hooks/useProducts.ts');
const mapper = find(hook, node => ts.isFunctionDeclaration(node) && node.name?.text === 'mapVpsProduct');
const card = source('components/products/ProductCard.tsx', ts.ScriptKind.TSX);
const toggle = find(card, node => ts.isVariableDeclaration(node) && node.name.getText(card) === 'handleToggleCatalogVisibility');
const quietConsole = { warn() {}, error() {}, log() {} };
function reloadProduct(hidden) {
    const row = { id: 'fixture-product', name: 'Fixture', status: 'active', hide_from_catalog: hidden };
    const context = execute(mapper, { ProductStatus: { ACTIVE: 'active' } });
    return context.mapVpsProduct(row);
}
for (const hidden of [1, true, 0, false]) {
    test(`admin reload preserves catalog visibility (${hidden}, ${typeof hidden})`, () => {
        assert.equal(Boolean(reloadProduct(hidden).hide_from_catalog), Boolean(hidden));
    });
}
for (const hidden of [1, 0]) {
    test(`catalog visibility click after reload sends the inverse of persisted state (${hidden})`, async () => {
        const product = reloadProduct(hidden);
        const calls = [];
        const context = execute(`${toggle};`, {
            product, isHiddenFromCatalog: Boolean(product.hide_from_catalog),
            setIsTogglingCatalogVisibility() {}, setIsHiddenFromCatalog() {},
            console: quietConsole, toast: { success() {}, error() {} },
            vpsApiService: { async updateProductCatalogVisibility(id, value) { calls.push({ id, value }); return true; } },
        });
        await vm.runInContext('handleToggleCatalogVisibility({ stopPropagation() {} })', context);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].id, product.id);
        assert.equal(calls[0].value, !Boolean(hidden));
    });
}

const bling = source('services/blingService.ts');
const tokenFunctions = ['getValidToken', 'refreshToken', 'clearStoredBlingConnection'].map(name =>
    find(bling, node => ts.isFunctionDeclaration(node) && node.name?.text === name)).join('\n');
function tokenFixture({ expired = true, response, networkError } = {}) {
    const settings = {
        bling_access_token: 'fixture-access', bling_refresh_token: 'fixture-refresh',
        bling_client_id: 'fixture-client', bling_client_secret: 'fixture-secret',
        bling_token_expires_at: new Date(Date.now() + (expired ? -3600000 : 3600000)).toISOString(),
    };
    const updates = [], requests = [];
    const context = execute(tokenFunctions, {
        console: quietConsole,
        companySettingsService: {
            async get() { return { ...settings }; },
            async update(patch) { updates.push(patch); Object.assign(settings, patch); },
        },
        async fetch(url, options) {
            requests.push({ url, options });
            if (networkError) throw networkError;
            assert.ok(response, 'An unexpected request must fail the test');
            return { ...response, json: async () => response.body };
        },
    });
    return { get: context.exports.getValidToken, settings, updates, requests };
}
test('Bling valid token does not refresh or write credentials', async () => {
    const fixture = tokenFixture({ expired: false });
    assert.equal(await fixture.get(), 'fixture-access');
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.updates.length, 0);
});
test('Bling successful refresh returns and stores the new credentials', async () => {
    const fixture = tokenFixture({ response: { ok: true, status: 200,
        body: { access_token: 'fixture-new-access', refresh_token: 'fixture-new-refresh', expires_in: 3600 } } });
    assert.equal(await fixture.get(), 'fixture-new-access');
    assert.equal(fixture.settings.bling_refresh_token, 'fixture-new-refresh');
    assert.equal(fixture.updates.length, 1);
    assert.ok(new Date(fixture.settings.bling_token_expires_at).getTime() > Date.now());
    assert.equal(JSON.parse(fixture.requests[0].options.body).grant_type, 'refresh_token');
});
for (const status of [429, 502, 503]) {
    test(`Bling temporary HTTP ${status} preserves saved credentials`, async () => {
        const fixture = tokenFixture({ response: { ok: false, status, body: { error: 'temporarily_unavailable' } } });
        await fixture.get({ forceRefresh: true }).catch(() => {});
        assert.equal(fixture.updates.length, 0, 'Temporary failure must not clear the connection');
        assert.equal(fixture.settings.bling_refresh_token, 'fixture-refresh');
    });
}
test('Bling expired token is never returned after a temporary renewal failure', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 502, body: { error: 'temporarily_unavailable' } } });
    await assert.rejects(fixture.get(), 'Caller must receive a failure instead of an expired token');
});
test('Bling network failure preserves credentials and rejects an expired token', async () => {
    const fixture = tokenFixture({ networkError: new Error('fixture network unavailable') });
    try { await assert.rejects(fixture.get()); }
    finally { assert.equal(fixture.updates.length, 0); }
});
test('Bling invalid grant clears the rejected credentials and propagates failure', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 400, body: { error: 'invalid_grant' } } });
    try { await assert.rejects(fixture.get()); }
    finally {
        assert.equal(fixture.settings.bling_access_token, null);
        assert.equal(fixture.settings.bling_refresh_token, null);
        assert.equal(fixture.settings.bling_token_expires_at, null);
    }
});

const page = source('pages/store/PublicProductPage.tsx', ts.ScriptKind.TSX);
const fallback = find(page, node => ts.isIfStatement(node)
    && node.expression.getText(page).includes('!isUuid')
    && node.getText(page).includes('const searchTerms'));
async function resolveFallback(slug, results, { uuid = false, networkError = false } = {}) {
    const calls = [];
    const context = execute(`async function lookup() { let data = null; const isUuid = ${uuid}; ${fallback}; return data; }`, {
        slug, console: quietConsole,
        vpsApiService: { async getProducts(params) {
            calls.push(params);
            if (networkError) throw new Error('fixture network unavailable');
            return results;
        } },
    });
    return { product: await context.lookup(), calls };
}
test('product URL fallback selects the exact slug even when it is not first', async () => {
    const exact = { id: 'exact', slug: 'redmi-15c' };
    assert.equal((await resolveFallback('redmi-15c', [{ id: 'other', slug: 'redmi-15' }, exact])).product.id, exact.id);
});
test('product URL fallback retains exact SKU matching without case sensitivity', async () => {
    assert.equal((await resolveFallback('r15c', [{ id: 'sku-match', sku: 'R15C' }])).product.id, 'sku-match');
});
test('product URL fallback never opens an unrelated search result', async () => {
    assert.equal((await resolveFallback('redmi-inexistente', [{ id: 'other', slug: 'redmi-15', sku: 'R15' }])).product, null);
});
test('product URL fallback remains unavailable on network error', async () => {
    assert.equal((await resolveFallback('redmi-15c', [], { networkError: true })).product, null);
});
test('UUID product routes never use approximate textual fallback', async () => {
    const result = await resolveFallback('fixture-uuid', [{ id: 'other' }], { uuid: true });
    assert.equal(result.product, null);
    assert.equal(result.calls.length, 0);
});

test('ambiguous exact product slugs remain unavailable in fallback', async () => {
    assert.equal((await resolveFallback('redmi-15c', [
        { id: 'one', slug: 'redmi-15c' }, { id: 'two', slug: 'redmi-15c' },
    ])).product, null);
});
test('fallback continues past irrelevant results to find an exact match', async () => {
    let calls = 0;
    const context = execute(`async function lookup() { let data = null; const isUuid = false; ${fallback}; return data; }`, {
        slug: 'redmi-15c',
        vpsApiService: { async getProducts() {
            return ++calls === 1 ? [{ id: 'other', slug: 'redmi-15' }] : [{ id: 'exact', slug: 'redmi-15c' }];
        } },
    });
    assert.equal((await context.lookup()).id, 'exact');
    assert.equal(calls, 2);
});
test('Bling proxy-wrapped invalid grant requires reconnection', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 400,
        body: { error: 'token_exchange_failed', debug: { rawMessage: 'invalid_grant' } } } });
    await assert.rejects(fixture.get(), /Reconecte manualmente/);
    assert.equal(fixture.settings.bling_refresh_token, null);
});
test('Bling proxy description of an invalid refresh token requires reconnection', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 400,
        body: { error: 'token_exchange_failed', debug: { rawMessage: 'The refresh token is invalid.' } } } });
    await assert.rejects(fixture.get(), /Reconecte manualmente/);
    assert.equal(fixture.settings.bling_refresh_token, null);
});
test('an upstream temporary failure never clears credentials even with an auth-looking body', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 503, body: { error: 'invalid_grant' } } });
    await assert.rejects(fixture.get());
    assert.equal(fixture.updates.length, 0);
});
test('Bling configuration rejection preserves credentials without false disconnect', async () => {
    const fixture = tokenFixture({ response: { ok: false, status: 400, body: { error: 'invalid_client' } } });
    await assert.rejects(fixture.get());
    assert.equal(fixture.updates.length, 0);
});
test('Bling malformed successful response never overwrites stored credentials', async () => {
    const fixture = tokenFixture({ response: { ok: true, status: 200, body: {} } });
    await assert.rejects(fixture.get());
    assert.equal(fixture.updates.length, 0);
});

const titleUpdateHandler = find(hook, node => ts.isVariableDeclaration(node)
    && node.name.getText(hook) === 'update' && node.getText(hook).includes('complement'));
const recentTitles = find(hook, node => ts.isVariableDeclaration(node) && node.name.getText(hook) === 'applyRecentTitles');
const cacheSave = find(hook, node => ts.isFunctionDeclaration(node) && node.name?.text === 'saveToCache');
const cacheLoad = find(hook, node => ts.isFunctionDeclaration(node) && node.name?.text === 'loadFromCache');
const fetchProductsNode = find(hook, node => ts.isVariableDeclaration(node) && node.name.getText(hook) === 'fetchProducts');
function titleFixture() {
    let products = [
        { id: 'parent', is_parent: true, name: 'C17', catalog_title_complement: 'Old', price_retail: 0 },
        { id: 'child', parent_id: 'parent', name: 'C17 Laranja', parent_catalog_title_complement: 'Old', price_retail: 130000, stock_quantity: 2 },
        { id: 'unrelated', name: 'Other', catalog_title_complement: 'Unchanged' },
    ];
    const initial = structuredClone(products);
    const storage = new Map();
    const context = execute(`${cacheSave}\n${cacheLoad}\n${mapper}\n${titleUpdateHandler};\n${recentTitles};\n${fetchProductsNode};`, {
        CACHE_KEY: 'fixture-products', CACHE_TIMESTAMP_KEY: 'fixture-ts', CACHE_TTL_MS: 300000,
        localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) ?? null },
        applyCatalogTitleUpdate, ProductStatus: { ACTIVE: 'active' },
        titleRevision: { current: 0 }, titleChanges: { current: new Map() },
        useCallback: fn => fn, console: quietConsole,
        setProducts: value => { products = typeof value === 'function' ? value(products) : value; },
        setCacheAge() {}, setFilteredProducts() {}, setIsLoading() {}, setIsRefreshing() {},
        setError: error => { assert.equal(error, null); },
        enrichProductsWithShopeeLinks: async data => data,
    });
    return { context, initial, products: () => products };
}
test('saved complement updates parent, children and cache without changing commercial data', () => {
    const fixture = titleFixture();
    fixture.context.event = { detail: { id: 'parent', complement: 'New' } };
    vm.runInContext('update(event)', fixture.context);
    const reloaded = fixture.context.loadFromCache();
    assert.equal(reloaded[0].catalog_title_complement, 'New');
    assert.equal(reloaded[1].parent_catalog_title_complement, 'New');
    assert.deepEqual(JSON.parse(JSON.stringify(reloaded)), fixture.initial.map(product => product.id === 'parent'
        ? { ...product, catalog_title_complement: 'New' }
        : product.parent_id === 'parent' ? { ...product, parent_catalog_title_complement: 'New' } : product));
});
test('a stale in-flight product reload cannot overwrite a newly saved complement', async () => {
    const fixture = titleFixture();
    let resolve;
    fixture.context.fetchAllAdminVpsProducts = () => new Promise(done => { resolve = done; });
    const pending = vm.runInContext('fetchProducts("background")', fixture.context);
    fixture.context.event = { detail: { id: 'parent', complement: 'Saved during request' } };
    vm.runInContext('update(event)', fixture.context);
    resolve(fixture.initial);
    await pending;
    assert.equal(fixture.products()[0].catalog_title_complement, 'Saved during request');
    assert.equal(fixture.context.loadFromCache()[1].parent_catalog_title_complement, 'Saved during request');
});
test('a later explicit reload can retrieve a newer server complement', async () => {
    const fixture = titleFixture();
    fixture.context.event = { detail: { id: 'parent', complement: 'First save' } };
    vm.runInContext('update(event)', fixture.context);
    fixture.context.fetchAllAdminVpsProducts = async () => fixture.initial.map(product =>
        ({ ...product, catalog_title_complement: 'Newer server value', parent_catalog_title_complement: 'Newer server value' }));
    await vm.runInContext('fetchProducts("refresh")', fixture.context);
    assert.equal(fixture.products()[0].catalog_title_complement, 'Newer server value');
});
test('clearing the complement clears the cached inherited title too', () => {
    const fixture = titleFixture();
    fixture.context.event = { detail: { id: 'parent', complement: '' } };
    vm.runInContext('update(event)', fixture.context);
    assert.equal(fixture.context.loadFromCache()[0].catalog_title_complement, '');
    assert.equal(fixture.context.loadFromCache()[1].parent_catalog_title_complement, '');
});
const api = source('services/vpsApiService.ts');
const saveTitleMethod = find(api, node => ts.isMethodDeclaration(node) && node.name.getText(api) === 'updateProductCatalogTitle');
for (const ok of [true, false]) {
    test(`complement cache update event is emitted only after a successful save (${ok})`, async () => {
        const events = [];
        let invalidations = 0;
        const context = execute(`class Api { ${saveTitleMethod} }; const api = new Api();`, {
            CATALOG_TITLE_UPDATED_EVENT,
            window: { dispatchEvent: event => events.push(event) },
            CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        });
        vm.runInContext('api', context).writeSafe = async (method, path, body) => {
            assert.equal(method, 'PATCH');
            assert.equal(path, '/products/parent/catalog-title');
            assert.equal(body.complement, ' New ');
            return ok;
        };
        vm.runInContext('api', context).invalidateProductCache = () => invalidations++;
        assert.equal(await vm.runInContext('api.updateProductCatalogTitle("parent", " New ")', context), ok);
        assert.equal(events.length, Number(ok));
        assert.equal(invalidations, Number(ok));
        if (ok) {
            assert.equal(events[0].type, CATALOG_TITLE_UPDATED_EVENT);
            assert.equal(events[0].detail.id, 'parent');
            assert.equal(events[0].detail.complement, 'New');
        }
    });
}
