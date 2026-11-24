// marketplace-auto-link-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketplaceAutoLink } = require('../services/marketplaceAutoLink.cjs');
const { patch } = require('../scripts/deploy-marketplace-auto-link.cjs');

function world() {
  const db = {
    products: [{ id: 'P1', sku: 'A21AZU' }, { id: 'P2', sku: 'A21ROS' }, { id: 'P3', sku: 'NOVO1' }, { id: 'P4', sku: 'DUP' }, { id: 'P5', sku: 'DUP' }, { id: 'P6', sku: 'MLSKU' }],
    main: [{ id: 'x', product_id: 'P1', connection_id: 'primary', shopee_item_id: 200, shopee_model_id: null }],
    extra: [], ml: [],
  };
  const pool = { query: async (sql, a = []) => {
    if (/CREATE TABLE/.test(sql)) return [{}];
    if (/FROM products WHERE sku/.test(sql)) return [db.products];
    if (/FROM shopee_shop_connections/.test(sql)) return [[]];
    if (/FROM shopee_products WHERE connection_id/.test(sql)) return [db.main.filter((l) => l.connection_id === a[0])];
    if (/FROM shopee_stock_extra_links WHERE connection_id/.test(sql)) return [db.extra.filter((l) => l.connection_id === a[0])];
    if (/INSERT INTO shopee_products/.test(sql)) { db.main.push({ product_id: a[1], connection_id: a[2], shopee_item_id: a[3], shopee_model_id: a[4] }); return [{}]; }
    if (/UPDATE shopee_products SET shopee_model_id/.test(sql)) { const l = db.main.find((x) => x.product_id === a[2] && x.connection_id === a[3]); l.shopee_model_id = a[0]; return [{}]; }
    if (/INSERT IGNORE INTO shopee_stock_extra_links/.test(sql)) { db.extra.push({ connection_id: a[0], shopee_item_id: a[1], shopee_model_id: a[2], product_id: a[3] }); return [{}]; }
    if (/FROM mercado_livre_settings/.test(sql)) return [[{ user_id: 9 }]];
    if (/FROM mercado_livre_products/.test(sql)) return [db.ml];
    if (/INSERT IGNORE INTO mercado_livre_products/.test(sql)) { db.ml.push({ item_id: a[1], variation_id: a[2], product_id: a[0] }); return [{}]; }
    throw new Error('sql ' + sql);
  } };
  // anúncio 200 (novo, com variações A21AZU/A21ROS), 100 (antigo duplicado com A21AZU), 300 (sem variação NOVO1), 400 (SKU repetido)
  const shopee = async (path, conn, p) => {
    if (path.endsWith('get_item_list')) return { response: { item: [{ item_id: 100 }, { item_id: 200 }, { item_id: 300 }, { item_id: 400 }], has_next_page: false } };
    if (path.endsWith('get_item_base_info')) return { response: { item_list: [{ item_id: 100, has_model: true }, { item_id: 200, has_model: true }, { item_id: 300, has_model: false, item_sku: 'novo1' }, { item_id: 400, has_model: false, item_sku: 'DUP' }] } };
    if (path.endsWith('get_model_list')) return { response: { model: p.item_id === 200 ? [{ model_id: 21, model_sku: 'A21AZU' }, { model_id: 22, model_sku: 'A21ROS' }] : [{ model_id: 11, model_sku: 'A21AZU' }] } };
  };
  const ml = async (path) => path.includes('/search') ? (path.includes('scroll_id') ? { results: [] } : { results: ['MLB1'], scroll_id: 's' })
    : [{ body: { id: 'MLB1', attributes: [{ id: 'SELLER_SKU', value_name: 'MLSKU' }] } }];
  return { db, pool, shopee, ml };
}

test('corrige variação, liga novo, duplicado vira extra, SKU repetido pula, ML liga; 2ª rodada não repete', async () => {
  const w = world(); const resynced = []; const notes = [];
  const a = createMarketplaceAutoLink({ pool: w.pool, shopee: w.shopee, ml: w.ml, resync: async (ids) => resynced.push(...ids), notify: async (t) => notes.push(t), logger: {}, pauseMs: 0 });
  const r = await a.run();
  assert.deepEqual(r['Shopee MV'], { ligado: 2, variacao_corrigida: 1, anuncio_extra: 1, sku_repetido: 1 });
  assert.equal(w.db.main.find((l) => l.product_id === 'P1').shopee_model_id, 21, 'P1 ganhou a variação do anúncio em que já estava');
  assert.deepEqual(w.db.extra.map((x) => [x.shopee_item_id, x.shopee_model_id, x.product_id]), [[100, 11, 'P1']]);
  assert.ok(w.db.main.find((l) => l.product_id === 'P3' && l.shopee_model_id === null));
  assert.equal(r['Mercado Livre'].ligado, 1);
  assert.deepEqual(resynced.sort(), ['P1', 'P2', 'P3', 'P6']);
  assert.match(notes[0], /Anúncios ligados ao estoque/);
  const r2 = await a.run();
  assert.deepEqual(r2['Shopee MV'], { ligado: 0, variacao_corrigida: 0, anuncio_extra: 0, sku_repetido: 1 });
  assert.equal(r2['Mercado Livre'].ligado, 0);
});

test('deploy: loader inclui os extras e rota/rotina registradas', () => {
  const src = "x\n    `SELECT product_id, connection_id, shopee_item_id, shopee_model_id\n       FROM shopee_products\n      WHERE product_id IN (${placeholders})\n        AND shopee_item_id IS NOT NULL`,\n    productIds\n  );\nfastify.post('/api/marketplace-stock/resync', x)";
  const o = patch(src);
  assert.match(o, /FROM shopee_stock_extra_links WHERE product_id/);
  assert.match(o, /marketplaceAutoLinkVps\.start\(\)/);
  assert.equal(patch(o), o);
});
