const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('services/catalogSectionsService.ts', 'utf8');
const key = source.match(/private CACHE_KEY_PREFIX = '([^']+)'/)[1] + 'section';
const section = { id: 'section', title: 'Smartphones', section_type: 'custom', max_products: 1 };
const ttl = 5 * 60 * 1000;

function setup(cached) {
  let now = 1000000, token = null, calls = 0, offline = true;
  const entries = new Map(cached == null ? [] : [[key, cached]]);
  const storage = {
    getItem: name => entries.get(name) || null,
    setItem: (name, value) => entries.set(name, value),
    removeItem: name => entries.delete(name),
  };
  const modules = {
    '@/services/catalogConfigService': { catalogConfigService: {
      getSettings: async () => ({}), applyVisibilityRules: rows => rows,
    } },
    '@/services/productNormalizer': { normalizeProduct: row => row },
    '@/services/vpsProxyBase': { buildVpsUrl: path => 'https://test.invalid' + path },
    '@/services/authSession': { buildAuthHeaders: async () => ({}), getCurrentAuthUserId: async () => null },
    '@/services/vpsAuthService': { vpsAuthService: { getStoredToken: () => token } },
  };
  const context = { exports: {}, require: id => modules[id] || {}, URLSearchParams, AbortSignal,
    window: { localStorage: storage }, Date: class extends Date { static now() { return now; } },
    console: { log() {}, warn() {}, error() {} },
    fetch: async () => {
      calls++;
      if (offline) throw new Error('offline');
      return { ok: true, json: async () => [{ id: 'live', price_retail: 2000, images: ['image'] }] };
    },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context);
  return { service: context.exports.catalogSectionsService, entries,
    get calls() { return calls; }, setNow: value => now = value,
    authenticate: () => token = 'admin', online: () => offline = false };
}
const cached = timestamp => JSON.stringify({ timestamp, data: [{ id: 'cached', price_retail: 1000 }] });

test('fresh public cache uses its original age; fallback expires at five minutes', async () => {
  const state = setup(cached(1000000 - ttl + 1));
  const service = state.service;
  let warnings = 0;
  assert.equal((await service.getProductsForSection(section))[0].id, 'cached');
  assert.equal(state.calls, 0);
  assert.equal((await service.getProductsForSection(section, true, () => warnings++))[0].id, 'cached');
  assert.equal(warnings, 1);
  assert.equal(JSON.parse(state.entries.get(key)).timestamp, 1000000 - ttl + 1);
  state.setNow(1000001);
  await assert.rejects(service.getProductsForSection(section, true), /offline/);
  assert.equal(state.entries.has(key), false);
});

test('expired, future, missing, string and malformed cache cannot supply prices on failure', async () => {
  for (const entry of [
    cached(1000000 - ttl), cached(1000001),
    '{"data":[]}', '{"timestamp":"999999","data":[]}',
    '{"timestamp":999999,"data":{}}', '{broken', null,
  ]) {
    const state = setup(entry);
    let warnings = 0;
    await assert.rejects(state.service.getProductsForSection(section, false, () => warnings++), /offline/);
    assert.equal(state.calls, 1);
    assert.equal(warnings, 0);
  }
});

test('authenticated readers never reuse public prices; successful fetch replaces expired cache', async () => {
  const authenticated = setup(cached(999999));
  authenticated.authenticate();
  await assert.rejects(authenticated.service.getProductsForSection(section), /offline/);
  assert.equal(authenticated.calls, 1);
  const state = setup(cached(1000000 - ttl));
  state.online();
  assert.equal((await state.service.getProductsForSection(section))[0].id, 'live');
  assert.equal(JSON.parse(state.entries.get(key)).timestamp, 1000000);
  assert.equal(JSON.parse(state.entries.get(key)).data[0].price_retail, 2000);
});

test('panel distinguishes failure from empty success and clears warnings after retry', async () => {
  const component = fs.readFileSync('components/catalog/CatalogSection.tsx', 'utf8');
  const start = component.indexOf('const loadProducts = async');
  const end = component.indexOf('\n    };', start) + 7;
  const code = ts.transpileModule(component.slice(start, end) + '; exports.loadProducts = loadProducts;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let mode = 'offline', products = [{ id: 'old' }], warning = null, loading = false, current = true;
  const context = {
    exports: {}, console: { error() {} }, section, customer: null, retryCount: 1,
    setLoading: value => loading = value, setLoadWarning: value => warning = value, setProducts: value => products = value,
    catalogSectionsService: { getProductsForSection: async (requested, bypass, fallback) => {
      assert.equal(bypass, true);
      if (mode === 'offline') throw new Error('offline');
      if (mode === 'fallback') { fallback(); return [{ id: 'cached' }]; }
      return [];
    } },
  };
  vm.runInNewContext(code, context);
  await context.exports.loadProducts(() => current);
  assert.equal(products.length, 0);
  assert.match(warning, /Não foi possível carregar/);
  assert.equal(loading, false);
  mode = 'fallback';
  await context.exports.loadProducts(() => current);
  assert.equal(products[0].id, 'cached');
  assert.match(warning, /cinco minutos/);
  mode = 'live';
  await context.exports.loadProducts(() => current);
  assert.equal(products.length, 0);
  assert.equal(warning, null);
  mode = 'offline'; current = false;
  await context.exports.loadProducts(() => current);
  assert.equal(warning, null);
  assert.match(component, /products.length === 0 && !loadWarning/);
  assert.match(component, /role="status"/);
  assert.match(component, /setRetryCount\(count => count \+ 1\)/);
});
