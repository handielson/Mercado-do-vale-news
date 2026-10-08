const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const Fastify = require('fastify');
const { registerProductReadPrivacy, filterProductPrices } = require('../services/productReadPrivacy.cjs');

const product = { id: 'p1', price_cost: 1000, price_retail: 2000, price_reseller: 1700,
  price_wholesale: 1500, specs: { color: 'Branco' }, created_at: new Date('2026-10-07'),
  components: [{ id: 'child', cost_price: 700, unit_cost: 700, purchase_price: 700, price_retail: 900 }] };

test('HTTP: every public product route protects prices and private responses cannot be cached', async () => {
  const app = Fastify();
  registerProductReadPrivacy(app, {
    getAuth: async req => ({
      'Bearer admin': { customerId: 'a', isAdmin: true, customerType: 'ADMIN' },
      'Bearer resale': { customerId: 'r', isAdmin: false, customerType: 'resale' },
      'Bearer wholesale': { customerId: 'w', isAdmin: false, customerType: 'wholesale' },
      'Bearer reseller': { customerId: 'r', isAdmin: false, customerType: 'RESELLER' },
      'Bearer retail': { customerId: 'c', isAdmin: false, customerType: 'retail' },
    }[req.headers.authorization] || { customerId: null, isAdmin: false }),
  });
  const paths = ['/products', '/products/by-ids', '/products/p1', '/products/by-slug/phone',
    '/products/by-ean/123', '/products/by-category/phones', '/products/p1/combo',
    '/storefronts/loja_3d/products', '/storefronts/loja_3d/products/p1'];
  for (const path of paths) app.get(path, async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return [product];
  });
  app.post('/products/batch', async () => product);
  app.get('/unrelated', async () => product);
  try {
    for (const path of paths) {
      for (const token of ['', 'invalid', 'retail', 'resale', 'wholesale', 'reseller', 'admin']) {
        const response = await app.inject({ url: `${path}?status=all&customer_type=ADMIN`,
          headers: token ? { authorization: `Bearer ${token}` } : {} });
        assert.equal(response.statusCode, 200);
        const data = response.json()[0];
        assert.equal(Object.hasOwn(data, 'price_cost'), token === 'admin', `${path} ${token}`);
        assert.equal(Object.hasOwn(data, 'price_reseller'), ['resale', 'wholesale', 'reseller', 'admin'].includes(token));
        assert.equal(Object.hasOwn(data, 'price_wholesale'), ['resale', 'wholesale', 'reseller', 'admin'].includes(token));
        assert.equal(data.price_retail, 2000);
        assert.equal(data.created_at, '2026-10-07T00:00:00.000Z');
        assert.equal(Object.hasOwn(data.components[0], 'unit_cost'), token === 'admin');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers['cdn-cache-control'], 'no-store');
        assert.match(response.headers.vary, /Authorization/);
      }
      const sync = await app.inject({ url: path, headers: { 'x-sync-key': 'server-only-secret' } });
      assert.equal(Object.hasOwn(sync.json()[0], 'price_cost'), false, 'transport key alone does not grant catalog privileges');
      const adminSync = await app.inject({ url: path, headers: { 'x-sync-key': 'server-only-secret', authorization: 'Bearer admin' } });
      assert.equal(adminSync.json()[0].price_cost, 1000);
      const forged = await app.inject({ url: path, headers: { 'x-sync-key': 'wrong' } });
      assert.equal(Object.hasOwn(forged.json()[0], 'price_cost'), false);
    }
    assert.equal((await app.inject({ method: 'POST', url: '/products/batch' })).json().price_cost, 1000);
    assert.equal((await app.inject({ url: '/unrelated' })).json().price_cost, 1000);
    assert.equal(product.price_cost, 1000, 'projection must not mutate the database row');
  } finally { await app.close(); }
});

test('transport headers alone grant no catalog privilege', async () => {
  const app = Fastify();
  registerProductReadPrivacy(app, { getAuth: async () => null });
  app.get('/products', async () => product);
  try {
    const result = await app.inject({ url: '/products', headers: { 'x-sync-key': 'anything' } });
    assert.equal(Object.hasOwn(result.json(), 'price_cost'), false);
  } finally { await app.close(); }
});

function loadTs(file, mocks, extra = '') {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta', '({ env: {} })');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code + extra, { exports, require: id => mocks[id] || {},
    window: { localStorage: { getItem() { return null; }, setItem() {} }, location: { pathname: '/' } },
    fetch: mocks.fetch, URLSearchParams, AbortController, setTimeout, clearTimeout, console });
  return exports;
}

test('frontend does not share a private product response with a subsequent anonymous session', async () => {
  let token = '';
  let reads = 0;
  const api = loadTs('services/vpsApiService.ts', {
    './authSession': { buildAuthHeaders: async extra => ({ ...extra, ...(token ? { Authorization: token } : {}) }) },
    './vpsProxyBase': { buildVpsUrl: p => p, getVpsSyncHeaders: () => ({}) },
    fetch: async (_url, options) => {
      reads++;
      if (token) assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => [{ id: 'p1', ...(token ? { price_cost: 1000 } : {}) }] };
    },
  }).vpsApiService;
  assert.equal(Object.hasOwn((await api.getProducts())[0], 'price_cost'), false);
  token = 'Bearer admin';
  assert.equal((await api.getProducts())[0].price_cost, 1000);
  assert.equal((await api.getProducts())[0].price_cost, 1000);
  token = '';
  assert.equal(Object.hasOwn((await api.getProducts())[0], 'price_cost'), false);
  assert.equal(reads, 3, 'private responses are never cached; anonymous cache remains safe');
});

test('persistent catalog caches are inaccessible while authenticated and old namespaces are retired', () => {
  let token = '';
  const auth = { getStoredToken: () => token };
  for (const file of ['services/catalogService.ts', 'services/catalogSectionsService.ts']) {
    const loaded = loadTs(file, { './vpsAuthService': { vpsAuthService: auth },
      '@/services/vpsAuthService': { vpsAuthService: auth } },
      file.includes('Sections') ? '' : '\nexports.testStorage = getStorage;');
    const storage = file.includes('Sections') ? () => loaded.catalogSectionsService.getStorage() : loaded.testStorage;
    token = '';
    assert.ok(storage());
    token = 'Bearer admin';
    assert.equal(storage(), null);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /@mv:(?:catalog:v8:|section_products:v6:)/);
  }
});

test('all API entrypoints use the canonical response protection and database customer type', () => {
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /productReadPrivacy\.cjs'\)\.registerProductReadPrivacy\(fastify/);
    assert.match(source, /customerType: customer\?\.customer_type \|\| null/);
  }
  const filtered = filterProductPrices(product, { isAdmin: false, isCommercial: false });
  assert.equal(filtered.price_cost, undefined);
  assert.equal(product.price_cost, 1000);
});
