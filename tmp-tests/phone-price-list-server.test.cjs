const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const Fastify = require('fastify');
const { buildPriceListGroups, validateSelection, registerPhonePriceListRoutes, readPublicImage } = require('../services/phonePriceListServer.cjs');
const phone = (overrides = {}) => ({ id: 'a', name: 'POCO X7 Preto', brand: 'Xiaomi', category_name: 'Celulares',
  specs: { ram: '8+8GB', storage: '256GB', color: 'Preto' }, price_retail: 159900, stock_quantity: 2,
  status: 'active', hide_from_catalog: 0, is_parent: 0, is_combo: 0, ...overrides });

test('separates POCO from Xiaomi, physical RAM, groups colors at official maximum cents', () => {
  const groups = buildPriceListGroups([phone(), phone({ id: 'b', name: 'POCO X7 Azul', specs: { ram: '8GB', storage: '256GB', color: 'Azul' }, price_retail: 169900 })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].brand, 'POCO');
  assert.equal(groups[0].priceCents, 169900);
  assert.equal(groups[0].memory, '8GB RAM • 256GB');
  assert.equal(groups[0].name, 'POCO X7');
});
test('excludes unavailable/hidden/accessory/parent and invalid prices', () => {
  for (const overrides of [{ stock_quantity: 0 }, { hide_from_catalog: 1 }, { status: 'draft' },
    { offer_visibility: 'hidden' }, { category_name: 'Acessórios para celulares' }, { is_parent: 1 },
    { is_combo: 1 }, { price_retail: 0 }, { price_retail: 123.45 }]) {
    assert.deepEqual(buildPriceListGroups([phone(overrides)]), []);
  }
});
test('serialized inventory overrides a stale positive product balance', () => {
  assert.deepEqual(buildPriceListGroups([phone({
    stock_quantity: 2,
    serialized_unit_count: 2,
    available_serialized_units: 0,
  })]), []);
  assert.equal(buildPriceListGroups([phone({
    stock_quantity: 0,
    serialized_unit_count: 2,
    available_serialized_units: 1,
  })]).length, 1);
});
test('bot selection retains only requested variants; stale price or stock fails closed', () => {
  const groups = [{ productIds: ['a'], name: 'POCO X7', memory: '8GB/256GB', priceCents: 159900 }];
  assert.equal(buildPriceListGroups([phone(), phone({ id: 'outside', price_retail: 999900 })], groups)[0].priceCents, 159900);
  assert.throws(() => buildPriceListGroups([phone({ price_retail: 160000 })], groups), { statusCode: 409 });
  assert.throws(() => buildPriceListGroups([phone({ stock_quantity: 0 })], groups), { statusCode: 409 });
  assert.throws(() => validateSelection({ groups: [...groups, ...groups] }), /repetido/);
  assert.throws(() => validateSelection({ brands: [] }), /Selecione/);
  assert.throws(() => validateSelection({ groups: [] }), /configurações/);
});
test('image loader rejects external and private destinations before fetching', async () => {
  for (const url of ['http://localhost/private', 'https://127.0.0.1/x', 'https://evil.example/a.png',
    'https://api.xiaomipetrolina.com.br.evil.example/a.png', 'https://user:pass@api.xiaomipetrolina.com.br/x']) {
    assert.equal(await readPublicImage(url), null);
  }
});
test('company logo stored as an inline image is decoded without external access', async () => {
  const source = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#f80' } }).png().toBuffer();
  const output = await readPublicImage(`data:image/png;base64,${source.toString('base64')}`);
  assert.equal((await sharp(output).metadata()).width, 20);
});
test('API deploy includes both renderer services', async () => {
  const deploy = await fs.readFile(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  assert.match(deploy, /services\/phonePriceListArtwork\.cjs/);
  assert.match(deploy, /services\/phonePriceListServer\.cjs/);
  assert.match(deploy, /\.\.\.phonePriceListServicePaths/);
});
test('authenticated preview returns real PNG pages, reuses cache and refreshes changed prices', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-phone-list-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const app = Fastify(); t.after(() => app.close());
  const png = await sharp({ create: { width: 40, height: 80, channels: 4, background: '#254d7f' } }).png().toBuffer();
  let rows = Array.from({ length: 7 }, (_, i) => phone({ id: String(i), name: `POCO X${i}`, specs: { ram: '8GB', storage: '256GB' }, images: ['https://api.xiaomipetrolina.com.br/images/test.png'] }));
  registerPhonePriceListRoutes(app, {
    uploadsDir: directory, publicApiUrl: 'https://api.xiaomipetrolina.com.br',
    requireSyncKeyOrAdmin: async (req, reply) => { if (req.headers.authorization !== 'test') return reply.code(401).send({ error: 'auth' }); },
    pool: { query: async (sql) => sql.includes('FROM company_settings') ? [[{ phone: '(87) 98803-2612', logo: '/brand/logo.png' }]] : [rows] },
    attachCatalogModelColorImages: async (products) => products,
    readImage: async () => png,
  });
  const request = (body = {}) => app.inject({ method: 'POST', url: '/admin/marketing/phone-price-list/preview', headers: { authorization: 'test' }, payload: body });
  assert.equal((await app.inject({ method: 'POST', url: '/admin/marketing/phone-price-list/preview', payload: {} })).statusCode, 401);
  const first = await request(); assert.equal(first.statusCode, 200, first.body);
  const data = first.json(); assert.equal(data.items.length, 2); assert.equal(data.productCount, 7);
  const file = path.join(directory, 'phone-price-lists', data.items[0].mediaUrl.split('/').pop());
  const meta = await sharp(await fs.readFile(file)).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1920);
  assert.deepEqual((await request()).json().items, data.items);
  rows = rows.map((p) => ({ ...p, price_retail: p.price_retail + 100 }));
  assert.notEqual((await request()).json().items[0].mediaUrl, data.items[0].mediaUrl);
  const stale = await request({ groups: [{ productIds: ['0'], name: 'POCO X0', memory: '8GB/256GB', priceCents: 159900 }] });
  assert.equal(stale.statusCode, 409);
});
