'use strict';
// product-promotions-list-v1: a Central de Promoções lista as promoções de preço dos produtos (ativas e agendadas)
// com atalho para editar na Página do Produto; banner-dates-mysql-v1: datas do banner no formato aceito pelo MySQL.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { selectCurrentProductPromotions } = require('../services/productPromotionsList.cjs');

const NOW = Date.parse('2026-11-11T12:00:00Z');
const row = (id, color, extra = {}) => ({ id, name: 'Poco C81 Pro ' + color, model_id: 'm1', model_name: 'Poco C81 Pro', specs: { ram: '4GB', storage: '128GB', color },
  price_retail: 96000, price_promo: 89900, promo_start: '2026-11-11T11:00:00.000Z', promo_end: '2026-11-12T13:00:00.000Z', available_stock: 2, ...extra });

test('uma linha por versão com a mesma promoção; cores e estoque somados', () => {
  const list = selectCurrentProductPromotions([row('a', 'Dourado'), row('b', 'Preto'), row('c', 'Verde', { specs: JSON.stringify({ ram: '4GB', storage: '128GB', color: 'Verde' }) })], NOW);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].colors, ['Dourado', 'Preto', 'Verde']);
  assert.deepEqual(list[0].productIds, ['a', 'b', 'c']);
  assert.equal(list[0].stock, 6);
  assert.equal(list[0].version, '4GB/128GB');
  assert.equal(list[0].status, 'active');
  assert.equal(list[0].discountPct, 6);
  assert.equal(list[0].modelId, 'm1');
});

test('agendada entra, encerrada e "promo" maior que o varejo não entram', () => {
  const list = selectCurrentProductPromotions([
    row('a', 'Preto'),
    row('s', 'Azul', { specs: { ram: '8GB', storage: '256GB', color: 'Azul' }, promo_start: '2026-11-20T11:00:00.000Z', promo_end: null }),
    row('x', 'Roxo', { specs: { ram: '6GB', storage: '128GB', color: 'Roxo' }, promo_end: '2026-11-10T00:00:00.000Z' }),
    row('y', 'Cinza', { specs: { ram: '6GB', storage: '256GB', color: 'Cinza' }, price_promo: 99000 }),
  ], NOW);
  assert.deepEqual(list.map(item => [item.version, item.status]), [['4GB/128GB', 'active'], ['8GB/256GB', 'scheduled']], 'ativas antes das agendadas');
  assert.equal(list[1].end, null);
});

test('aceita datas do MySQL como Date ou texto sem fuso (UTC)', () => {
  const list = selectCurrentProductPromotions([row('a', 'Preto', { promo_start: new Date('2026-11-11T11:00:00Z'), promo_end: '2026-11-12 13:00:00' })], NOW);
  assert.equal(list[0].start, '2026-11-11T11:00:00.000Z');
  assert.equal(list[0].end, '2026-11-12T13:00:00.000Z');
});

test('API, tela e deploy ligados', () => {
  const server = fs.readFileSync('services/promoCampaignServer.cjs', 'utf8');
  assert.match(server, /'\/admin\/marketing\/product-promotions'/);
  assert.match(server, /selectCurrentProductPromotions\(rows\)/);
  const page = fs.readFileSync('pages/admin/promotions/PromotionsPage.tsx', 'utf8');
  assert.match(page, /promoCampaignService\.listProductPromotions\(\)/);
  assert.match(page, /\/admin\/products\/models\/\$\{promo\.modelId\}#promo-\$\{promo\.firstProductId\}/);
  assert.match(page, /<ProductPromotionsSection \/>/);
  const version = fs.readFileSync('components/products/ModelVersionFinancials.tsx', 'utf8');
  assert.match(version, /window\.location\.hash\.replace\(\/\^#promo-\/, ''\)/);
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(deploy, /'services\/productPromotionsList\.cjs'/);
  assert.match(deploy, /--promo-campaign-only/);
});

test('banner grava datas em UTC no formato do MySQL (ISO com Z é recusado)', () => {
  const service = fs.readFileSync('services/bannerService.ts', 'utf8');
  const match = service.match(/export function toBannerDbDate\(value: unknown\): string \| null \| undefined \{([\s\S]*?)\n\}/);
  assert.ok(match, 'função de data do banner');
  const body = match[1].replace(/: unknown/g, '');
  const toBannerDbDate = new Function('value', body);
  assert.equal(toBannerDbDate('2026-11-12T13:00:00.000Z'), '2026-11-12 13:00:00');
  assert.equal(toBannerDbDate(null), null);
  assert.equal(toBannerDbDate(''), null);
  assert.equal(toBannerDbDate(undefined), undefined);
  assert.match(service, /for \(const key of \['start_date', 'end_date'\]\) \{\s*if \(key in payload\) payload\[key\] = toBannerDbDate\(payload\[key\]\);/);
});
