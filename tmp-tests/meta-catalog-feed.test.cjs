'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const fs = require('node:fs');
const { buildMetaCatalogFeed, registerMetaCatalogFeed } = require('../services/metaCatalogFeedServer.cjs');
const settings = { enable_public_catalog: 1, show_prices: 1, require_login: 0, hide_out_of_stock: 1, min_stock_to_show: 1 };
const product = { id: 'id-1', name: 'Celular & <modelo>', description: '<p>Tela & câmera</p>', sku: 'SKU', brand: 'Marca',
  price_retail: '123456.00', stock_quantity: '2', track_inventory: 1, status: 'active',
  specs: { color: 'Preto', condition: 'used', imei1: 'PRIVATE-SERIAL' },
  resolved_images: ['data:image/png;base64,PRIVATE', 'https://example.test/image.jpg?a=1&b=2'],
  price_cost: 555, customer: 'PRIVATE-CUSTOMER' };
test('RSS escapes text and URLs, converts cents once, and exports only public fields', () => {
  const feed = buildMetaCatalogFeed([product], settings);
  assert.equal(feed.count, 1);
  assert.match(feed.body, /1234\.56 BRL/);
  assert.match(feed.body, /Celular &amp; &lt;modelo&gt;/);
  assert.match(feed.body, /a=1&amp;b=2/);
  assert.match(feed.body, /<g:condition>used/);
  assert.match(feed.body, /https:\/\/www\.mercadodovale\.com\.br\/produto\/id-1/);
  assert.doesNotMatch(feed.body, /PRIVATE|price_cost|customer|data:image/);
});
test('visibility, stock and invalid required fields exclude items; untracked stock remains available', () => {
  const excluded = [
    { stock_quantity: 0 }, { hide_from_catalog: 1 }, { exclude_from_seo: 1 }, { is_parent: 1 },
    { status: 'inactive' }, { offer_type: 'offer', offer_visibility: 'hidden' },
    { price_retail: 0 }, { price_retail: 1.5 }, { price_retail: 'invalid' }, { resolved_images: ['data:image/png;no'] }, { brand: '' },
  ].map((patch, index) => ({ ...product, id: 'excluded-' + index, ...patch }));
  const feed = buildMetaCatalogFeed([...excluded, { ...product, track_inventory: 0, stock_quantity: 0 }], settings);
  assert.equal(feed.count, 1);
  assert.doesNotMatch(feed.body, /excluded-/);
  assert.match(feed.body, /<g:availability>in stock/);
  assert.throws(() => buildMetaCatalogFeed([{ ...product, stock_quantity: 1 }], { ...settings, min_stock_to_show: 2 }));
});
test('sale price respects date window; variants retain identity and grouping', () => {
  const promo = { ...product, parent_id: 'parent', price_promo: 99900, promo_start: '2026-10-01T00:00:00Z', promo_end: '2026-11-01T00:00:00Z' };
  assert.match(buildMetaCatalogFeed([promo], settings, new Date('2026-10-27T00:00:00Z')).body, /<g:sale_price>999\.00 BRL/);
  const expired = buildMetaCatalogFeed([promo], settings, new Date('2026-12-01T00:00:00Z')).body;
  assert.doesNotMatch(expired, /sale_price/);
  assert.match(expired, /<g:item_group_id>parent/);
});
test('private, hidden-price and empty catalogs fail closed instead of replacing remote catalog with nothing', () => {
  for (const patch of [{ enable_public_catalog: 0 }, { require_login: 1 }, { show_prices: 0 }]) {
    assert.throws(() => buildMetaCatalogFeed([product], { ...settings, ...patch }));
  }
  assert.throws(() => buildMetaCatalogFeed([], settings));
});
test('HTTP endpoint serves XML and returns a retryable 503 on source failure', async () => {
  const app = Fastify();
  let broken = false;
  const pool = { query: async sql => {
    if (broken) throw new Error('Database unavailable');
    return [sql.includes('FROM catalog_settings') ? [settings] : [product]];
  } };
  registerMetaCatalogFeed(app, { pool, comboStockSql: () => 'stock_quantity', attachCatalogModelColorImages: async rows => rows });
  try {
    const response = await app.inject('/api/meta-catalog.xml');
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /application\/xml/);
    assert.equal(response.headers['x-catalog-product-count'], '1');
    assert.equal(response.headers['cache-control'], 'no-store');
    broken = true;
    const failure = await app.inject('/api/meta-catalog.xml');
    assert.equal(failure.statusCode, 503);
    assert.equal(failure.headers['retry-after'], '300');
    assert.doesNotMatch(failure.body, /Database unavailable|<rss/);
  } finally { await app.close(); }
});
test('all runtime entries and selective/full deployments retain the public feed', () => {
  const { patch } = require('../scripts/deploy-meta-catalog-feed.cjs');
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(file, 'utf8');
    const hook = source.split('\n').find(line => line.includes('registerMetaCatalogFeed'));
    assert.ok(hook, file + ' must register the feed');
    assert.equal(patch(source), source);
    const without = source.replace(hook + '\n', '');
    assert.equal(patch(without).replace(/\r\n/g, '\n'), source.replace(/\r\n/g, '\n'));
  }
  assert.throws(() => patch('unknown runtime'));
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(deploy, /--meta-catalog-feed-only/);
  assert.match(deploy, /upload\(path.join\(__dirname, 'services\/metaCatalogFeedServer.cjs'\)/);
});
