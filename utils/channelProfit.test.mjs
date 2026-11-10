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

import { suggestTikTokFeesFromSummary } from './channelProfit.js';
test('TikTok: sugere taxas pelo extrato sem contar totais nem SKU duas vezes', () => {
  const s = suggestTikTokFeesFromSummary({
    revenue_cents: 100000, orders_with_statement: 4,
    fields: [
      { path: 'statement_transactions[].revenue_amount', total_cents: 100000 },
      { path: 'statement_transactions[].fee_amount', total_cents: -15000 },
      { path: 'statement_transactions[].settlement_amount', total_cents: 85000 },
      { path: 'statement_transactions[].platform_commission_amount', total_cents: -6000 },
      { path: 'statement_transactions[].transaction_fee_amount', total_cents: -3000 },
      { path: 'statement_transactions[].affiliate_commission_amount', total_cents: -2000 },
      { path: 'statement_transactions[].actual_shipping_fee_amount', total_cents: -4000 },
      { path: 'statement_transactions[].sku_statement_transactions[].platform_commission_amount', total_cents: -6000 },
      { path: 'statement_transactions[].shipping_fee_amount', total_cents: 1500 },
    ],
  });
  assert.equal(s.commissionPct, 6);
  assert.equal(s.otherPct, 5, 'transação + afiliado');
  // tiktok-net-shipping-v1: sem shipping_cost_amount, frete = abertura com sinal (-40 + 15) / 4 pedidos.
  assert.equal(s.shippingCents, 625, 'frete líquido pago pela loja por pedido');
  assert.deepEqual(s.parts.commission.map(p => p.key), ['platform_commission_amount']);
});

import { TIKTOK_PUBLISHED_FEE } from './channelProfit.js';
test('channel-fee-exact-v1: comissão por faixa e programa de frete com teto (TikTok)', () => {
  const fee = normalizeChannelFee('tiktok', TIKTOK_PUBLISHED_FEE);
  const capa = calculateChannelProfit({ priceCents: 3000, costCents: 1000, fee });
  assert.equal(capa.commissionPct, 10);
  assert.equal(capa.commissionCents, 300);
  assert.equal(capa.fixedCents, 400);
  assert.equal(capa.shippingProgramCents, 180);
  assert.equal(capa.feesCents, 880);
  const celular = calculateChannelProfit({ priceCents: 150000, costCents: 100000, fee });
  assert.equal(celular.commissionPct, 6);
  assert.equal(celular.commissionCents, 9000);
  assert.equal(celular.fixedCents, 600);
  assert.equal(celular.shippingProgramCents, 5000);
  assert.equal(celular.feesCents, 14600);
  const limite = calculateChannelProfit({ priceCents: 5000, costCents: 0, fee });
  assert.equal(limite.commissionPct, 6);
  assert.equal(limite.fixedCents, 600);
});

test('faixa sem comissão própria usa a geral; config antiga continua igual', () => {
  const fee = normalizeChannelFee('shopee_m', { commissionPct: 20, tiers: [{ upToCents: null, fixedCents: 400 }] });
  assert.equal(fee.tiers[0].commissionPct, null);
  assert.equal(fee.shippingProgramPct, 0);
  assert.equal(fee.shippingProgramCapCents, null);
  const r = calculateChannelProfit({ priceCents: 10000, costCents: 0, fee });
  assert.equal(r.commissionCents, 2000);
  assert.equal(r.shippingProgramCents, 0);
  assert.equal(r.feesCents, 2400);
});
