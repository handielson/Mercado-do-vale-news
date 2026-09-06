const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { paginatePhonePriceList, renderPhonePriceListPage } = require('../services/phonePriceListArtwork.cjs');

test('pagination keeps every variant and original objects, six per brand page', () => {
  const items = Object.freeze(Array.from({ length: 19 }, (_, i) => Object.freeze({ id: i, brand: i < 13 ? 'POCO' : i < 16 ? 'xiaomi' : 'realme' })));
  const pages = paginatePhonePriceList(items);
  assert.deepEqual(pages.map((p) => [p.brand, p.items.length]), [['Xiaomi', 3], ['POCO', 6], ['POCO', 6], ['POCO', 1], ['realme', 3]]);
  assert.equal(new Set(pages.flatMap((p) => p.items.map((item) => item.id))).size, 19);
  assert.equal(pages[1].items[0], items[0]);
  assert.equal(pages[3].pageNumber, 3);
  assert.equal(pages[3].totalPages, 3);
  assert.deepEqual(paginatePhonePriceList([]), []);
  assert.equal(paginatePhonePriceList([{ brand: 'Outra', name: 'POCO X7' }])[0].brand, 'Outra');
});

test('renderer produces portrait PNG, escapes text and composites image buffers', async () => {
  const photo = await sharp({ create: { width: 220, height: 400, channels: 3, background: '#47b48a' } }).png().toBuffer();
  const items = Object.freeze(Array.from({ length: 6 }, (_, i) => Object.freeze({ id: i, name: 'Modelo teste <&> "especial"', memory: '256 GB • 8 GB RAM', priceCents: 123456, imageBuffer: photo })));
  const output = await renderPhonePriceListPage({ brand: 'POCO', items, logoBuffer: photo, whatsapp: '(00) 00000-0000', website: 'exemplo.test', generatedAt: '2026-09-06T12:00:00Z' });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  const pixel = await sharp(output).extract({ left: 220, top: 230, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...pixel].slice(0, 3), [71, 180, 138]);
  if (process.env.PHONE_PRICE_LIST_PREVIEW) await sharp(output).toFile(process.env.PHONE_PRICE_LIST_PREVIEW);
});

test('renderer rejects absent or non-cent prices and invalid page sizes', async () => {
  for (const priceCents of [undefined, null, 0, -1, 12.99, '1299', NaN]) {
    await assert.rejects(renderPhonePriceListPage({ items: [{ name: 'Teste', priceCents }] }), /centavos/);
  }
  await assert.rejects(renderPhonePriceListPage({ items: [] }), /1 a 6/);
  await assert.rejects(renderPhonePriceListPage({ items: Array(7).fill({ priceCents: 100 }) }), /1 a 6/);
  const output = await renderPhonePriceListPage({ items: [{ name: 'Sem foto', priceCents: 199 }], generatedAt: '2026-09-06' });
  assert.equal((await sharp(output).metadata()).width, 1080);
});
