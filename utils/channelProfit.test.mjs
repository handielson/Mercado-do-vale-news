import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateChannelProfit, defaultChannelFee, normalizeChannelFee, tierFixedFee } from './channelProfit.js';

test('Shopee: 20% + taxa fixa da faixa', () => {
  const r = calculateChannelProfit({ priceCents: 15000, costCents: 8000, fee: defaultChannelFee('shopee_m') });
  assert.equal(r.commissionCents, 3000);
  assert.equal(r.fixedCents, 2000);
  assert.equal(r.profitCents, 15000 - 8000 - 5000);
});

test('faixas: limite inclusivo e última sem teto', () => {
  const tiers = defaultChannelFee('shopee_g').tiers;
  assert.equal(tierFixedFee(tiers, 7999), 400);
  assert.equal(tierFixedFee(tiers, 8000), 1600);
  assert.equal(tierFixedFee(tiers, 900000), 2800);
});

test('teto de comissão, imposto, embalagem e margem', () => {
  const fee = normalizeChannelFee('tiktok', { commissionPct: 10, commissionCapCents: 500, taxPct: 5, packagingCents: 200 });
  const r = calculateChannelProfit({ priceCents: 10000, costCents: 6000, fee });
  assert.equal(r.commissionCents, 500);
  assert.equal(r.taxCents, 500);
  assert.equal(r.feesCents, 1200);
  assert.equal(r.profitCents, 2800);
  assert.equal(r.marginPct, 28);
});

test('site sem taxa: lucro = preço - custo', () => {
  const r = calculateChannelProfit({ priceCents: 5000, costCents: 3000, fee: normalizeChannelFee('site', null) });
  assert.equal(r.profitCents, 2000);
});
