const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const Fastify = require('fastify');
const { buildPriceListGroups, validateSelection, registerPhonePriceListRoutes, readPublicImage } = require('../services/phonePriceListServer.cjs');
const { patchCardDependency } = require('../scripts/deploy-phone-price-list.cjs');

test('selective deployment preserves unrelated runtime code and is idempotent', () => {
  const source = 'async function calculateAutoresponderMaxInstallment(price) {}\nregisterMarketingCampaignRoutes(fastify, {\n  buildWhatsAppStoryItems: buildWhatsAppStatusStoryItemsVps,\n  other: keepMe,\n});\nconst fiscal = untouched;';
  const patched = patchCardDependency(source);
  assert.equal(patchCardDependency(patched), patched);
  assert.ok(patched.includes('  other: keepMe,\n});\nconst fiscal = untouched;'));
  assert.throws(() => patchCardDependency(source + source), /ambiguous/);
  assert.throws(() => patchCardDependency('no calculator'), /missing/);
});
const phone = (overrides = {}) => ({ id: 'a', name: 'POCO X7 Preto', brand: 'Xiaomi', category_name: 'Celulares',
  specs: { ram: '8+8GB', storage: '256GB', color: 'Preto' }, price_retail: 159900, stock_quantity: 2,
  status: 'active', hide_from_catalog: 0, is_parent: 0, is_combo: 0, ...overrides });

test('all brands includes Oukitel and future brands while selected and legacy recipes stay restricted', () => {
  const rows = [phone(), phone({ id: 'o', name: 'C17 Plus', brand_name: 'Oukitel', brand: 'brand-id' }),
    phone({ id: 'n', name: 'New phone', brand_name: 'Nova marca', brand: 'new-id' }),
    phone({ id: 'hidden', name: 'Hidden phone', brand_name: 'Hidden', hide_from_catalog: 1 }),
    phone({ id: 'gone', name: 'Sold phone', brand_name: 'Gone', stock_quantity: 0 })];
  const all = validateSelection({ brandMode: 'all', brands: [], layout: 'list' });
  assert.equal(all.brands, null);
  assert.deepEqual(buildPriceListGroups(rows, undefined, all.brands).map(g => g.brand).sort(), ['Nova marca', 'Oukitel', 'POCO']);
  assert.equal(buildPriceListGroups(rows).length, 1);
  assert.deepEqual(buildPriceListGroups(rows, undefined, ['oukitel']).map(g => g.brand), ['Oukitel']);
  assert.deepEqual(validateSelection({ brandMode: 'selected', brands: [' Oukitel '] }).brands, ['Oukitel']);
  for (const input of [{ brandMode: 'invalid' }, { brands: [null] }, { brands: [' '] }, { brands: ['a'.repeat(101)] }]) {
    assert.throws(() => validateSelection(input), { statusCode: 400 });
  }
});

test('separates POCO from Xiaomi, physical RAM, groups colors at official maximum cents', () => {
  const groups = buildPriceListGroups([phone(), phone({ id: 'b', name: 'POCO X7 Azul', specs: { ram: '8GB', storage: '256GB', color: 'Azul' }, price_retail: 169900 })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].brand, 'POCO');
  assert.equal(groups[0].priceCents, 169900);
  assert.equal(groups[0].memory, '8GB RAM • 256GB');
  assert.equal(groups[0].name, 'POCO X7');
});
test('registered model and physical memory merge inconsistent names without merging configurations', () => {
  const variant = (id, name, ram, storage, price_retail, extra = {}) => phone({ id, name,
    model_id: 'x8-pro', model_name: 'POCO X8 Pro', specs: { ram, storage, color: id }, price_retail, ...extra });
  const rows = [
    variant('black', 'Poco X8 Pró', '8GB', '256GB', 260000),
    variant('yellow', 'Poco X8 Pró 5G', '8+8GB', '256 GB', 266000),
    variant('green', 'Poco X8 Pró 5G, NFC, 256GB, 8GB Ram, Global Cor:Verde', '8 GB', '256GB', 265000),
    variant('white', 'Poco X8 Pró 5G', '12GB', '512GB', 263000),
    variant('gone', 'Poco X8 Pró', '8GB', '256GB', 999900, { stock_quantity: 0 }),
    variant('other', 'Poco X8 Pró', '8GB', '256GB', 300000, { model_id: 'different-model', model_name: 'Other model' }),
  ];
  for (const mode of ['none', 'cash', 'card']) {
    const groups = buildPriceListGroups(rows, undefined, ['POCO'], mode);
    assert.equal(groups.length, 3);
    const merged = groups.find(g => g.products.some(p => p.id === 'black'));
    assert.equal(merged.name, 'POCO X8 Pro');
    assert.equal(merged.memory, '8GB RAM • 256GB');
    assert.equal(merged.priceCents, 266000);
    assert.deepEqual(merged.products.map(p => p.id), ['black', 'yellow', 'green']);
    assert.ok(groups.some(g => g.memory === '12GB RAM • 512GB'));
  }
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

test('list modes validate inputs and allow unpriced available phones only without prices', () => {
  assert.deepEqual(validateSelection({ brands: ['POCO'] }), { brands: ['POCO'], groups: undefined, layout: 'cards', priceMode: 'cash' });
  assert.throws(() => validateSelection({ priceMode: 'invalid' }), /Selecione/);
  assert.throws(() => validateSelection({ priceMode: 'card', layout: 'cards' }), /layout/);
  assert.equal(buildPriceListGroups([phone({ price_retail: 0 })], undefined, ['POCO'], 'none').length, 1);
  assert.equal(buildPriceListGroups([phone({ price_retail: 0 })], undefined, ['POCO'], 'cash').length, 0);
  assert.equal(buildPriceListGroups([phone({ stock_quantity: 0 })], undefined, ['POCO'], 'none').length, 0);
});

test('list API isolates mode caches and refreshes card fees, while preserving legacy cards', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-phone-list-modes-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const app = Fastify(); t.after(() => app.close());
  const rows = Array.from({ length: 14 }, (_, i) => phone({ id: String(i), name: `POCO X${i}` }));
  let fee = 12;
  let available = true;
  const bases = [];
  registerPhonePriceListRoutes(app, {
    uploadsDir: directory,
    requireSyncKeyOrAdmin: async () => {},
    pool: { query: async sql => sql.includes('FROM company_settings') ? [[{ phone: '87988032612' }]] : [rows] },
    attachCatalogModelColorImages: async products => products,
    readImage: async () => null,
    calculateCardInstallment: async base => {
      bases.push(base);
      return available ? { installments: 12, value: Math.round(Math.round(base * (1 + fee/100))/12), total: Math.round(base * (1 + fee/100)) } : null;
    },
  });
  const request = priceMode => app.inject({ method: 'POST', url: '/admin/marketing/phone-price-list/preview', payload: { brands: ['POCO'], layout: 'list', priceMode } });
  const urls = [];
  for (const mode of ['none', 'cash', 'card']) {
    const response = await request(mode);
    assert.equal(response.statusCode, 200, response.body);
    const data = response.json();
    assert.equal(data.productCount, 14);
    assert.equal(data.items.length, 1);
    assert.deepEqual(data.warnings, []);
    urls.push(data.items[0].mediaUrl);
  }
  assert.equal(new Set(urls).size, 3);
  assert.deepEqual(bases, [159900]);
  assert.equal((await request('card')).json().items[0].mediaUrl, urls[2]);
  fee = 15;
  assert.notEqual((await request('card')).json().items[0].mediaUrl, urls[2]);
  available = false;
  assert.equal((await request('card')).statusCode, 409);
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
  assert.deepEqual(data.availableBrands, ['POCO']);
  rows.push(phone({ id: 'oukitel', name: 'C17 Plus', brand_name: 'Oukitel', brand: 'brand-id', images: [] }));
  const all = await request({ brandMode: 'all', layout: 'list', brands: [] });
  assert.equal(all.statusCode, 200, all.body);
  assert.equal(all.json().productCount, 8);
  assert.deepEqual(all.json().availableBrands, ['Oukitel', 'POCO']);
  assert.ok(all.json().items.some(item => item.label.includes('Oukitel')));
  rows = rows.filter(p => p.id !== 'oukitel');
  const file = path.join(directory, 'phone-price-lists', data.items[0].mediaUrl.split('/').pop());
  const meta = await sharp(await fs.readFile(file)).metadata();
  assert.equal(meta.width, 1080); assert.equal(meta.height, 1920);
  assert.deepEqual((await request()).json().items, data.items);
  rows = rows.map((p) => ({ ...p, price_retail: p.price_retail + 100 }));
  assert.notEqual((await request()).json().items[0].mediaUrl, data.items[0].mediaUrl);
  const stale = await request({ groups: [{ productIds: ['0'], name: 'POCO X0', memory: '8GB/256GB', priceCents: 159900 }] });
  assert.equal(stale.statusCode, 409);
});
