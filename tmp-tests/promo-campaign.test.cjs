'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../services/promoPricingCore.cjs');
const { selectPromoCampaignProducts } = require('../services/promoCampaignServer.cjs');
const { buildPromoPageSvg, paginatePromoItems } = require('../services/promoCampaignArtwork.cjs');
const { buildPriceListGroups } = require('../services/phonePriceListServer.cjs');
const { priceListRecipe } = require('../services/socialStoryPriceListBatches.cjs');
const { getProductPriceCents } = require('../services/autoresponderCatalogPreferences.cjs');

const NOW = Date.parse('2026-11-20T15:00:00Z');
const base = { price_retail: 189900, price_promo: 169900 };

test('promoção vale só dentro do período e abaixo do varejo', () => {
  assert.equal(core.isPromoActive({ ...base }, NOW), true, 'sem datas = ativa');
  assert.equal(core.isPromoActive({ ...base, promo_start: '2026-11-21T00:00:00Z' }, NOW), false, 'ainda não começou');
  assert.equal(core.isPromoActive({ ...base, promo_end: '2026-11-20T14:59:00Z' }, NOW), false, 'já terminou');
  assert.equal(core.isPromoActive({ ...base, promo_start: '2026-11-20T00:00:00Z', promo_end: '2026-11-21T00:00:00Z' }, NOW), true);
  assert.equal(core.isPromoActive({ price_retail: 1000, price_promo: 1000 }, NOW), false, 'promo igual ao varejo não é promoção');
  assert.equal(core.effectivePriceCents({ ...base, promo_end: '2026-11-01T00:00:00Z' }, NOW), 189900);
  assert.equal(core.effectivePriceCents({ ...base }, NOW), 169900);
  assert.deepEqual(core.promoPriceFields({ ...base, promo_end: '2026-11-01T00:00:00Z' }, NOW), { price_effective: 189900, promo_active: false });
});

test('SQL do bot compara com UTC_TIMESTAMP e respeita início/fim', () => {
  const sql = core.activePromoPriceSql();
  assert.match(sql, /promo_start IS NULL OR promo_start <= UTC_TIMESTAMP\(\)/);
  assert.match(sql, /promo_end IS NULL OR promo_end >= UTC_TIMESTAMP\(\)/);
  assert.match(sql, /price_promo < price_retail/);
  assert.match(core.effectivePriceSql('p'), /^COALESCE\(\(CASE WHEN p\.price_promo/);
});

test('campanha exige título e só aceita mídia HTTPS', () => {
  assert.throws(() => core.normalizePromoCampaign({ headline: '  ' }), /título/i);
  assert.throws(() => core.normalizePromoCampaign({ headline: 'X', media_url: 'http://a/b.png' }), /HTTPS/);
  assert.deepEqual(core.normalizePromoCampaign({ headline: ' 🔥 BLACK FRIDAY ', footer: '', media_url: 'https://a/b.mp4', media_type: 'video' }),
    { headline: '🔥 BLACK FRIDAY', footer: '', media_url: 'https://a/b.mp4', media_type: 'video' });
});

test('texto do WhatsApp: título na primeira linha, de/por e rodapé', () => {
  const result = core.buildPromoWhatsAppText({ headline: '🔥 BLACK FRIDAY 🔥', footer: 'Parcelamos em 12x',
    items: [{ name: 'Redmi Note 15 8/256', retailCents: 189900, promoCents: 169900, promoEnd: '2026-11-30T02:59:00Z' }] });
  const lines = result.text.split('\n');
  assert.equal(lines[0], '🔥 BLACK FRIDAY 🔥');
  assert.match(result.text, /de ~R\$\s1\.899,00~ por \*R\$\s1\.699,00\*/);
  assert.match(result.text, /_válido até 29\/11_/, 'data no horário de Brasília');
  assert.equal(lines.at(-1), 'Parcelamos em 12x');
  assert.equal(result.fitsMediaCaption, true);
});

test('campanha pega só promoção ativa com estoque, maior desconto primeiro', () => {
  const rows = [
    { id: 'a', name: 'A', ...base, available_stock: 3, track_inventory: 1 },
    { id: 'b', name: 'B', price_retail: 10000, price_promo: 5000, available_stock: 1, track_inventory: 1 },
    { id: 'c', name: 'C', ...base, available_stock: 0, track_inventory: 1 },
    { id: 'd', name: 'D', ...base, available_stock: 5, track_inventory: 1, promo_end: '2026-11-19T00:00:00Z' },
    { id: 'e', name: 'E', ...base, available_stock: 0, track_inventory: 0 },
  ];
  assert.deepEqual(selectPromoCampaignProducts(rows, NOW).map((p) => p.id), ['b', 'a', 'e']);
});

test('arte dos stories mostra título, preço riscado e preço novo', () => {
  const svg = buildPromoPageSvg({ headline: 'NATAL', footer: 'Até 12x', whatsapp: '(87) 99999-0000', website: 'mercadodovale.com.br',
    items: [{ name: 'Fone XYZ', retailCents: 12900, promoCents: 9900, untilLabel: '25/12' }] });
  assert.match(svg, />NATAL</);
  assert.match(svg, /de R\$\s129,00/);
  assert.match(svg, /por R\$\s99,00/);
  assert.match(svg, /válido até 25\/12/);
  assert.throws(() => buildPromoPageSvg({ headline: 'X', items: [{ name: 'Y', retailCents: 100, promoCents: 100 }] }));
  assert.equal(paginatePromoItems(Array.from({ length: 13 }, (_, i) => ({ i }))).length, 3);
});

test('tabela de celulares usa a promoção ativa e aceita o preço de varejo antigo do bot', () => {
  const phone = { id: 'p1', name: 'Redmi Note 15', brand: 'Xiaomi', status: 'active', stock_quantity: 2, category_name: 'Celulares',
    specs: { ram: '8GB', storage: '256GB' }, ...base };
  const [group] = buildPriceListGroups([phone]);
  assert.equal(group.priceCents, 169900);
  const [legacy] = buildPriceListGroups([phone], [{ productIds: ['p1'], name: 'Redmi Note 15', memory: '', priceCents: 189900 }]);
  assert.equal(legacy.priceCents, 169900, 'renderiza o preço efetivo');
  assert.throws(() => buildPriceListGroups([phone], [{ productIds: ['p1'], name: 'R', memory: '', priceCents: 123 }]), /preço da lista mudou/);
  const [expired] = buildPriceListGroups([{ ...phone, promo_end: '2020-01-01T00:00:00Z' }]);
  assert.equal(expired.priceCents, 189900);
});

test('agendamento dinâmico aceita a receita da campanha de promoção', () => {
  assert.deepEqual(priceListRecipe({ kind: 'promo' }), { kind: 'promo' });
});

test('preferências do catálogo do bot ignoram promoção vencida', () => {
  assert.equal(getProductPriceCents({ ...base, promo_end: '2020-01-01T00:00:00Z' }), 189900);
  assert.equal(getProductPriceCents({ ...base }), 169900);
});

test('API e bot usam a regra de data da promoção', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /COALESCE\(NULLIF\(price_promo, 0\), price_retail\)/, `${file}: filtro do bot sem data`);
    assert.doesNotMatch(source, /price_promo \|\| product\.price_retail/, `${file}: Marketplace sem data`);
    assert.match(source, /\.\.\.promoPriceFields\(r\),[\s\S]*\.\.\.promoPriceFields\(r\),/, `${file}: /products sem price_effective`);
    assert.match(source, /comboStockSql,\n\s*sendWhatsAppStoryMedia/, `${file}: campanha sem estoque de kit`);
  }
  const deploy = fs.readFileSync(path.join(__dirname, '..', 'deploy-vps-server-only.cjs'), 'utf8');
  for (const file of ['promoPricingCore.cjs', 'promoCampaignArtwork.cjs', 'promoCampaignServer.cjs']) assert.match(deploy, new RegExp(`services/${file}`));
});

test('campo de data da promoção mostra o horário local, não o UTC cortado', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/products/sections/ProductPricing.tsx'), 'utf8');
  assert.doesNotMatch(source, /iso\.slice\(0, 16\)/);
  assert.match(source, /date\.getHours\(\)/);
});
