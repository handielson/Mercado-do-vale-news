const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fastify = require('fastify');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { routePatterns, spaBlock } = require('../scripts/sync-nginx-spa-routes.cjs');
const { registerLegacyCatalogSeo, resolveLegacyCategory } = require('../services/legacyCatalogSeo.cjs');

const categories = [
  { id: 'pc', name: 'Informática', slug: 'informatica' },
  { id: 'mouse', parent_id: 'pc', name: 'Mouses', slug: 'mouses' },
];

test('legacy categories preserve the actual category and safely retire unmatched paths', async () => {
  const app = fastify();
  registerLegacyCatalogSeo(app, { pool: { query: async () => [categories] } });
  for (const uri of ['/categoria-produtos/informatica/', '/categoria-produtos/informatica/page/3/?add-to-compare=17332']) {
    const result = await app.inject({ url: '/api/seo-legacy-category', headers: { 'x-original-uri': uri } });
    assert.equal(result.statusCode, 301);
    assert.equal(result.headers.location, 'https://www.mercadodovale.com.br/produtos?categoria=pc');
  }
  assert.equal(await resolveLegacyCategory('/categoria-produtos/informatica/mouses/', categories), '/produtos?categoria=mouse');
  for (const uri of ['/categoria-produtos/removed/', '/categoria-produtos/wrong/mouses/', 'https://evil.test/no-category']) {
    const result = await app.inject({ url: '/api/seo-legacy-category', headers: { 'x-original-uri': uri } });
    assert.equal(result.statusCode, 410);
    assert.match(result.body, /noindex, follow/);
    assert.equal(result.headers.location, undefined);
  }
  const ambiguous = [...categories, { id: 'another', name: 'Informática', slug: 'informatica' }];
  assert.equal(await resolveLegacyCategory('/categoria-produtos/informatica/', ambiguous), null);
  await app.close();
});

test('database outage is retryable, never a removal or homepage redirect', async () => {
  const app = fastify();
  registerLegacyCatalogSeo(app, { pool: { query: async () => { throw new Error('unavailable'); } } });
  const result = await app.inject({ url: '/api/seo-legacy-category' });
  assert.equal(result.statusCode, 503);
  assert.equal(result.headers['retry-after'], '60');
  await app.close();
});

test('SPA whitelist follows every active route and rejects paths from the coverage report', () => {
  const source = fs.readFileSync('routes/index.tsx', 'utf8');
  const patterns = routePatterns(source);
  const matcher = new RegExp('^(?:' + patterns.join('|') + ')/?$');
  for (const pattern of patterns) {
    const example = pattern.replaceAll('(?:/[^/]+)?', '/example').replaceAll('[^/]+', 'example');
    assert.ok(matcher.test(example), example);
  }
  for (const uri of ['/', '/admin/pdv', '/admin/products/uuid/slug', '/produtos', '/produto/redmi-15c',
    '/loja-3d/conta/google/callback', '/pedido/uuid/confirmacao', '/delivery/token', '/auth/callback']) {
    assert.ok(matcher.test(uri), uri);
  }
  for (const uri of ['/madeireira-total-materiais-de-construcao-em-novo-hamburgo/',
    '/otica-korndorfer-oculos-armacao-novo-hamburgo-canudos',
    '/wp-includes/js/wp-emoji-release.min.js', '/produtos/not-a-collection', '/produto/slug/3715',
    '/produto/slug/feed/', '/contato/', '/unknown']) assert.equal(matcher.test(uri), false, uri);
  assert.equal(routePatterns('// path: "/commented"\n const route = { path: "*" };').length, 0);
  for (const name of ['production', 'staging']) {
    const config = fs.readFileSync('infra/nginx/mdv-site-' + name + '.conf', 'utf8');
    assert.ok(config.includes(spaBlock(source)), name + ': generated routes out of date');
    assert.match(config, /location \/ \{\s*try_files \$uri \$uri\/ =404;/);
    assert.ok(config.indexOf('/api/seo-produto?slug=$1') < config.indexOf('# BEGIN GENERATED SPA ROUTES'));
    assert.match(config, /location \^~ \/wp-includes\/ \{\s*return 410;/);
    assert.match(config, /slug=\$1&legacy=1/);
    assert.ok(Math.max(...config.split('\n').map(line => Buffer.byteLength(line))) < 4096);
  }
});

test('only fully loaded, empty, out-of-range catalog pages receive noindex', async () => {
  const { isCatalogPageOutOfRange, getCatalogPageSlice } = await import('../pages/catalog/catalogPagination.js');
  const done = { page: 34, itemCount: 0, loading: false, fetching: false, hasMore: false, error: null, paginated: true };
  assert.equal(isCatalogPageOutOfRange(done), true);
  for (const override of [{ page: 1 }, { itemCount: 1 }, { loading: true }, { fetching: true },
    { hasMore: true }, { error: 'offline' }, { paginated: false }]) {
    assert.equal(isCatalogPageOutOfRange({ ...done, ...override }), false);
  }
  assert.deepEqual(getCatalogPageSlice(['first', 'second', 'third'], 2, 2).items, ['third']);
});

test('legacy numeric product URLs redirect only after resolving a real public product', async () => {
  for (const entry of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
    const source = fs.readFileSync(entry, 'utf8');
    const start = source.indexOf("fastify.get('/api/seo-produto',");
    const end = source.indexOf('\n});', start) + '\n});'.length;
    const app = fastify();
    let product = { slug: 'redmi-15c', seo_route_target: 'redmi-15c-verde-8gb-256gb' };
    vm.runInNewContext(source.slice(start, end), {
      fastify: app,
      readSeoIndexHtml: () => '<html></html>',
      loadSeoProductBySlug: async () => product,
      buildSeoBaseUrl: () => 'https://www.mercadodovale.com.br',
    });
    const linked = await app.inject({ url: '/api/seo-produto?slug=redmi-15c&legacy=1' });
    assert.equal(linked.statusCode, 301, entry);
    assert.equal(linked.headers.location, 'https://www.mercadodovale.com.br/produto/redmi-15c-verde-8gb-256gb', entry);
    product = null;
    const gone = await app.inject({ url: '/api/seo-produto?slug=removed&legacy=1' });
    assert.equal(gone.statusCode, 410, entry);
    assert.equal(gone.headers.location, undefined, entry);
    await app.close();
    assert.ok(fs.readFileSync('deploy-vps-server-only.cjs', 'utf8').includes("'services/legacyCatalogSeo.cjs'"));
  }
});

test('selective deployment preserves unrelated remote code and rejects redirect drift', () => {
  const { patch, BASELINE } = require('../scripts/deploy-seo-soft-404.cjs');
  for (const entry of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const baseline = execFileSync('git', ['show', BASELINE + ':' + entry], { encoding: 'utf8', maxBuffer: 15e6 });
    const current = fs.readFileSync(entry, 'utf8');
    assert.equal(patch(baseline).replaceAll('\r\n', '\n'), current.replaceAll('\r\n', '\n'));
    const remote = '// Remote customization\n' + baseline;
    assert.ok(patch(remote).startsWith('// Remote customization\n'));
    assert.equal(patch(patch(remote)), patch(remote));
    assert.throws(() => patch(baseline.replace("fastify.get('/api/seo-produto',", "fastify.get('/api/changed',")), /anchor drift/);
    assert.throws(() => patch(current.replace("request.query?.legacy || ''", "request.query?.legacy || 'unexpected'")), /redirect drift/);
  }
});
