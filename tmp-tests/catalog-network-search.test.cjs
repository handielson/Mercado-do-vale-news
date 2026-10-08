const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(sourcePath, dependencies = {}) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const context = { exports: {}, console, window: undefined, require(name) {
        if (!(name in dependencies)) throw new Error(`Unmocked dependency: ${name}`);
        return dependencies[name];
    } };
    vm.runInNewContext(js, context, { filename: sourcePath });
    return context.exports;
}
const filtering = load('services/catalogFiltering.ts');
const modelSpecs = load('services/smartphoneModelSpecs.mjs');
const normalizer = load('services/productNormalizer.ts', {
    '@/utils/media-url': { toBrowserSafeMediaUrl: url => url },
    '@/utils/field-standards': { ProductStatus: { ACTIVE: 'active', INACTIVE: 'inactive' } },
    './smartphoneModelSpecs.mjs': modelSpecs,
});
const defaults = load('types/catalogSettings.ts');
const categories = [{ id: 'phones', name: 'Smartphones', slug: 'smartphones' }, { id: 'cases', name: 'Capinhas', slug: 'capinhas' }];
const phone = (id, overrides = {}) => ({
    id, name: 'Poco X8 Pró', sku: id, category_id: 'phones', brand: 'Xiaomi',
    status: 'active', track_inventory: true, stock_quantity: 1, price_retail: 260000,
    created_at: new Date().toISOString(), specs: { rede_operadora: '5G', ram: '8GB', storage: '256GB' },
    model_template_values: { rede_operadora: '5G' },
    images: ['https://example.com/phone.png'], ...overrides,
});

function service(apiOverrides = {}) {
    const calls = [];
    const api = {
        getCategories: async () => categories,
        getCatalogSettings: async () => ({ hide_out_of_stock: true, hide_zero_price: true, min_stock_to_show: 1 }),
        getProducts: async params => { calls.push(params); return []; },
        getProductsByIds: async () => [],
        ...apiOverrides,
    };
    const config = load('services/catalogConfigService.ts', {
        './vpsApiService': { vpsApiService: api }, './vpsClient': { vpsClient: {} }, '@/types/catalogSettings': defaults,
    });
    const exports = load('services/catalogService.ts', {
        './authSession': {}, './vpsAuthService': { vpsAuthService: { getStoredToken: () => null } },
        '@/services/vpsApiService': { vpsApiService: api }, '@/services/productNormalizer': normalizer,
        '@/services/catalogConfigService': config, '@/services/vpsProxyBase': {}, '@/services/vpsClient': {},
        './catalogFiltering': filtering, './colors': {}, './model-color-images': {},
    });
    return { catalog: exports.catalogService, calls, api };
}

test('5G isolado é rede; memória, Wi-Fi, SKU e acessórios permanecem textuais', () => {
    for (const query of ['5g', '5 G', 'Celular 5G', 'smartphones 5g', '5g celulares']) {
        assert.equal(filtering.getCatalogNetworkQuery(query), '5G');
    }
    assert.equal(filtering.getCatalogNetworkQuery('4G'), '4G');
    for (const query of ['5GB', '5 GB de RAM', 'Wi-Fi 5GHz', 'KA-322-5G', 'capa Poco X8 5G', 'Poco X8 Pró']) {
        assert.equal(filtering.getCatalogNetworkQuery(query), undefined);
    }
});

test('rede não usa título nem Wi-Fi; correção no modelo prevalece sobre cópias antigas', () => {
    assert.equal(filtering.matchesCatalogNetwork(phone('5g'), '5G'), true);
    assert.equal(filtering.matchesCatalogNetwork(phone('lte', { model_template_values: { rede_operadora: '5G / 4G / 3G / 2G' } }), '5G'), true);
    assert.equal(filtering.matchesCatalogNetwork(phone('4g', { name: 'Celular 5G', specs: { rede_operadora: '4G', wifi_celulares: '2.4GHz e 5GHz' }, model_template_values: { rede_operadora: '4G' } }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('wifi', { model_template_values: { rede_operadora: '5GHz' } }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('unknown', { specs: {}, model_template_values: {} }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('model', { specs: {}, model_template_values: { rede_operadora: '5G' } }), '5G'), true);
    assert.equal(filtering.matchesCatalogNetwork(phone('override', { specs: { rede_operadora: '5G' }, model_template_values: { rede_operadora: '4G' } }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('blank-model', { specs: { rede_operadora: '5G' }, model_template_values: { rede_operadora: ' ' } }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('absent-model', { specs: { rede_operadora: '5G' }, model_template_values: undefined }), '5G'), false);
    assert.equal(filtering.matchesCatalogNetwork(phone('no', { model_template_values: { rede_operadora: 'Não suporta 5G' } }), '5G'), false);
});

test('consulta 5G encontra modelo sem 5G no nome, preserva RAM/cor e exclui corrigidos, ocultos e sem estoque', async () => {
    const rows = [phone('white', { specs: { rede_operadora: '5G', color: 'Branco', ram: '12GB', storage: '512GB' } }),
        phone('model-only', { specs: { color: 'Preto' }, model_template_values: { rede_operadora: '5G' } }),
        phone('c85', { name: 'C85 Pró', specs: { rede_operadora: '5G', wifi_celulares: '5GHz' }, model_template_values: { rede_operadora: '4G' } }),
        phone('hidden', { hide_from_catalog: true }), phone('zero', { stock_quantity: 0 }),
        phone('case', { category_id: 'cases' })];
    const calls = [];
    const { catalog } = service({ getProducts: async params => { calls.push(params); return rows; } });
    const result = await catalog.getProducts({ search: '5g' }, 1, 150);
    assert.deepEqual(Array.from(result.products, p => p.id), ['white', 'model-only']);
    assert.equal(result.products[0].specs.ram, '12GB');
    assert.equal(result.products[0].specs.color, 'Branco');
    assert.equal(calls[0].search, undefined);
    assert.equal(calls[0].category, 'phones');
    assert.equal(calls[0].includeModelSpecs, true);
    assert.equal(calls[0].compact, true);
    assert.equal(result.hasMore, false);
});

test('busca geral carrega além de 500 e páginas locais mantêm o restante acessível', async () => {
    const rows = Array.from({ length: 533 }, (_, i) => phone(`p${i}`, { created_at: '2026-10-01', category_id: i < 500 ? 'cases' : 'phones' }));
    const offsets = [];
    const { catalog } = service({ getProducts: async params => { offsets.push(params.offset); return rows.slice(params.offset, params.offset + params.limit); } });
    const first = await catalog.getProducts({ search: 'Poco' }, 1, 150);
    assert.equal(first.total, 533);
    assert.equal(first.products.length, 150);
    assert.equal(first.hasMore, true);
    assert.deepEqual(offsets, [0, 500]);
    const fourth = await catalog.getProducts({ search: 'Poco' }, 4, 150);
    assert.equal(fourth.products.length, 83);
    assert.equal(fourth.products.filter(p => p.category_id === 'phones').length, 33);
    assert.equal(fourth.hasMore, false);
});

test('busca aplica marca, preço, estoque, categoria, novidades, destaque e ordenação antes da página', async () => {
    const rows = [phone('cheap', { brand: 'xiaomi', price_retail: 10000, custom_fields: { featured: true } }),
        phone('expensive', { price_retail: 20000, custom_fields: { featured: true } }),
        phone('wrong-brand', { brand: 'Realme', price_retail: 15000 }), phone('old', { created_at: '2020-01-01' })];
    const { catalog } = service({ getProducts: async () => rows });
    const result = await catalog.getProducts({ search: 'Poco', categories: ['phones'], brands: ['Xiaomi'],
        priceRange: [5000, 25000], inStockOnly: true, newOnly: true, featuredOnly: true, sortBy: 'price_desc' }, 1, 1);
    assert.equal(result.total, 2);
    assert.equal(result.products[0].id, 'expensive');
    assert.equal(result.hasMore, true);
});

test('favoritos autenticados vão ao servidor; consulta sem cliente não expõe favoritos', async () => {
    const { catalog, calls } = service();
    await catalog.getProducts({ search: 'Poco', favoritesOnly: true, customerId: 'customer-test' });
    assert.equal(calls[0].favoritesOnly, true);
    assert.equal(calls[0].customerId, 'customer-test');
    const before = calls.length;
    const result = await catalog.getProducts({ search: 'Poco', favoritesOnly: true });
    assert.equal(result.total, 0);
    assert.equal(calls.length, before);
});

test('falha no segundo lote não retorna um falso resultado completo', async () => {
    const { catalog } = service({ getProducts: async params => params.offset ? null : Array.from({ length: 500 }, (_, i) => phone(String(i))) });
    await assert.rejects(catalog.getProducts({ search: 'Poco' }), /todos os resultados/);
});

test('categoria selecionada restringe busca textual no servidor; acessórios não viram rede celular', async () => {
    const { catalog, calls } = service();
    await catalog.getProducts({ search: 'capa Poco X8 5G', categories: ['cases'] });
    assert.equal(calls[0].category, 'cases');
    assert.equal(calls[0].search, 'capa Poco X8 5G');
    assert.equal(calls[0].includeModelSpecs, false);
    const before = calls.length;
    const network = await catalog.getProducts({ search: '5G', categories: ['cases'] });
    assert.equal(network.total, 0);
    assert.equal(calls.length, before);
});

test('EAN continua no endpoint exato e respeita categoria, marca e visibilidade', async () => {
    let ean;
    const { catalog, calls } = service({ getProductByEan: async value => {
        ean = value; return [phone('valid'), phone('hidden', { hide_from_catalog: true }), phone('case', { category_id: 'cases' })];
    } });
    const result = await catalog.getProducts({ search: '7891234567890', categories: ['phones'], brands: ['Xiaomi'] });
    assert.equal(ean, '7891234567890');
    assert.deepEqual(Array.from(result.products, p => p.id), ['valid']);
    assert.equal(calls.length, 0);
});

test('mídia ausente no compacto é recuperada somente para a página visível', async () => {
    let ids;
    const { catalog } = service({ getProducts: async () => [phone('one', { images: [] }), phone('two', { images: [] })],
        getProductsByIds: async input => { ids = input; return input.map(id => phone(id)); } });
    const result = await catalog.getProducts({ search: 'Poco' }, 1, 1);
    assert.deepEqual(Array.from(ids), ['one']);
    assert.equal(result.products[0].images.length, 1);
});

test('seções da busca com ou sem categorias selecionadas oferecem carregar mais', () => {
    const source = fs.readFileSync('pages/catalog/index.tsx', 'utf8');
    const control = source.split('{hasActiveSearch && !isPaginatedCatalogMode && hasMore && (')[1]?.split('</button>')[0];
    assert.ok(control, 'Carregar mais atende tanto isAllChildrenMode quanto isSearchCategoryMode');
    assert.match(control, /onClick=\{loadMore\}/);
    assert.match(control, /disabled=\{loading \|\| fetching\}/);
    assert.match(control, /Carregar mais resultados/);
});
