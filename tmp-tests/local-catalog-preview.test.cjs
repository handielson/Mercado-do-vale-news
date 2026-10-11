'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createLocalCatalogPreviewServer } = require('../services/localCatalogPreviewServer.cjs');
const productServiceSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../services/products.ts'), 'utf8');

const parentId = 'e2b33395-d233-4deb-8839-d19624ea4545';
const childId = '5e72ccd8-f501-4d23-a550-0ad7a9ef8403';
const localOnlyId = '11111111-2222-4333-8444-555555555555';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

test('SKU automático local considera catálogo e rascunhos concorrentes, sem escrever na produção', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-preview-sku-'));
  const writes = [];
  const app = createLocalCatalogPreviewServer({ port: 0, syncKey: 'test', draftFile: path.join(directory, 'drafts.json'),
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') {
        writes.push(JSON.parse(options.body));
        return json({ upserted: 0, errors: [{ error: 'SKU já está em uso' }] });
      }
      if (new URL(url).pathname === '/products') return json([{ id: parentId, sku: 'CHAV0009' }]);
      return json({ error: 'not found' }, 404);
    },
  });
  await app.start();
  t.after(async () => { await app.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const ids = [localOnlyId, '11111111-2222-4333-8444-555555555556'];
  const responses = await Promise.all(ids.map(id => fetch(`${base}/products/batch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ id, name: 'Chaveiro personalizado', sku: '' }]),
  })));
  for (const response of responses) assert.equal(response.status, 200);
  const products = await Promise.all(ids.map(async id => (await fetch(`${base}/products/${id}`)).json()));
  assert.deepEqual(products.map(product => product.sku).sort(), ['CHAV0010', 'CHAV0011']);
  for (const product of products) assert.equal(product.name, `Chaveiro personalizado - ${product.sku}`);
  assert.equal(writes.length, 0);
  const rename = await fetch(`${base}/products/${ids[0]}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Vaso decorativo' }),
  });
  assert.equal(rename.status, 200);
  assert.equal((await (await fetch(`${base}/products/${ids[0]}`)).json()).sku, products[0].sku);
  const approval = await fetch(`${base}/admin/local-preview/drafts/${ids[0]}/approve`, { method: 'POST', headers: { 'x-sync-key': 'test' } });
  assert.equal(approval.status, 409);
  assert.equal(writes[0][0].sku, products[0].sku);
  assert.equal(writes[0][0].name, 'Vaso decorativo', 'aprovação preserva a edição manual posterior do nome');
  assert.equal((await (await fetch(`${base}/products/${ids[0]}`)).json()).sku, products[0].sku, 'aprovação recusada mantém rascunho e SKU');
});

test('prévia local usa descrição do pai e só grava na API central após aprovação explícita', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-preview-'));
  const upstreamWrites = [];
  const child = { id: childId, parent_id: parentId, name: 'Variante branca', sku: 'SFKU3XMVB', description: '<p>Descrição da variante</p>', status: 'active', is_print3d: 1, price_retail: 1990, storefront: 'loja_3d', specs: {} };
  const parent = { id: parentId, name: 'Produto pai', description: '<h2>Descrição do pai</h2><ul><li>Item da embalagem</li></ul>', specs: {} };
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (options.method === 'PUT') { upstreamWrites.push({ pathname, body: JSON.parse(options.body) }); return json({ ok: true }); }
    if (pathname === `/products/${parentId}`) return json(parent);
    if (pathname === `/products/${childId}`) return json(child);
    if (pathname === '/storefronts/loja_3d/products') return json([child]);
    if (pathname === `/storefronts/loja_3d/products/${childId}`) return json(child);
    if (pathname === `/admin/products/${childId}/storefront-offers`) return json({ offers: [] });
    return json({ error: `rota remota inesperada: ${pathname}` }, 404);
  };
  const app = createLocalCatalogPreviewServer({ port: 0, syncKey: 'test-sync-key', draftFile: path.join(directory, 'drafts.json'), fetchImpl });
  await app.start();
  t.after(async () => { await app.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`;

  const save = await fetch(`${base}/products/${childId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: '<p>Rascunho da variante</p>', price_retail: 2090, dimensions: { height_cm: 3.5, width_cm: 2, depth_cm: 1.2 }, weight_kg: 0.012 }) });
  assert.equal(save.status, 200);
  const changedSku = await fetch(`${base}/products/${childId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: 'SKU-ALTERADO' }) });
  assert.equal(changedSku.status, 409);
  assert.match((await changedSku.json()).error, /não pode ser alterado/);
  const preserved = await (await fetch(`${base}/products/${childId}`)).json();
  assert.equal(preserved.sku, 'SFKU3XMVB');
  assert.deepEqual(upstreamWrites, [], 'salvar no localhost não pode escrever na API central');

  const catalog = await (await fetch(`${base}/storefronts/loja_3d/products?limit=20`)).json();
  assert.equal(catalog.length, 1);
  assert.match(catalog[0].description, /Descrição do pai/);
  assert.match(catalog[0].description, /Item da embalagem/);
  assert.equal(catalog[0].price_retail, 2090);
  assert.deepEqual(catalog[0].dimensions, { height_cm: 3.5, width_cm: 2, depth_cm: 1.2 });
  assert.equal(catalog[0].weight_kg, 0.012);
  assert.deepEqual(upstreamWrites, [], 'medidas do preview também permanecem locais até aprovação');

  const forbidden = await fetch(`${base}/admin/local-preview/drafts/${childId}/approve`, { method: 'POST' });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(upstreamWrites, [], 'aprovação sem chave local não pode publicar');

  const approved = await fetch(`${base}/admin/local-preview/drafts/${childId}/approve`, { method: 'POST', headers: { 'x-sync-key': 'test-sync-key' } });
  assert.equal(approved.status, 200);
  assert.equal(upstreamWrites.length, 1);
  assert.equal(upstreamWrites[0].pathname, `/products/${childId}`);
  assert.equal(upstreamWrites[0].body.description, '<p>Rascunho da variante</p>');
});

test('cadastro local permanece rascunho e sÃ³ cria o produto central ao aprovar', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-preview-create-'));
  const upstreamWrites = [];
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (options.method === 'POST') {
      upstreamWrites.push({ pathname, body: JSON.parse(options.body) });
      return json({ ok: true, upserted: 1, errors: [] });
    }
    if (pathname === '/storefronts/loja_3d/products') return json([]);
    return json({ error: `rota remota inesperada: ${pathname}` }, 404);
  };
  const app = createLocalCatalogPreviewServer({ port: 0, syncKey: 'test-sync-key', draftFile: path.join(directory, 'drafts.json'), fetchImpl });
  await app.start();
  t.after(async () => { await app.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`;

  const create = await fetch(`${base}/products/batch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ id: localOnlyId, name: 'Produto local', sku: 'LOCAL-3D', status: 'active', is_print3d: 1, price_retail: 2500 }]),
  });
  assert.equal(create.status, 200);
  assert.deepEqual(upstreamWrites, [], 'cadastro no localhost nÃ£o pode criar na API central');

  const localProduct = await (await fetch(`${base}/products/${localOnlyId}`)).json();
  assert.equal(localProduct.name, 'Produto local');

  const approved = await fetch(`${base}/admin/local-preview/drafts/${localOnlyId}/approve`, { method: 'POST', headers: { 'x-sync-key': 'test-sync-key' } });
  assert.equal(approved.status, 200);
  assert.deepEqual(upstreamWrites, [{ pathname: '/products/batch', body: [{ id: localOnlyId, name: 'Produto local', sku: 'LOCAL-3D', status: 'active', is_print3d: 1, price_retail: 2500 }] }]);
});

test('produto salvo na prÃ©via nÃ£o dispara efeitos colaterais de produÃ§Ã£o', () => {
  const localGuard = 'if (isLocalCatalogPreviewRuntime()) return savedProduct;';
  const firstGuard = productServiceSource.indexOf(localGuard);
  const secondGuard = productServiceSource.indexOf(localGuard, firstGuard + 1);
  assert.ok(firstGuard >= 0 && secondGuard >= 0, 'criaÃ§Ã£o e ediÃ§Ã£o precisam parar no rascunho local');
  assert.ok(firstGuard < productServiceSource.indexOf('const priceAdjustment = await syncVariationPrices(savedProduct);'));
  assert.ok(secondGuard < productServiceSource.indexOf('await logPriceChange(id,'));
  assert.ok(secondGuard < productServiceSource.lastIndexOf('const priceAdjustment = await syncVariationPrices(savedProduct);'));
});
