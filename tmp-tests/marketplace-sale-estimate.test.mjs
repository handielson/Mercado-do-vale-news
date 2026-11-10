// marketplace-sale-financials-ml-tiktok-v1: estimativa pelas taxas configuradas (fallback de ML/TikTok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEstimatedMarketplaceFinancial } from '../utils/marketplaceSaleEstimate.js';
import { calculateChannelProfit, normalizeChannelFee } from '../utils/channelProfit.js';

const unavailable = {
  source: 'tiktok_statement',
  origin: 'marketplace',
  state: 'unavailable',
  note: 'sem escopo (105005)',
  payout_cents: null,
  cost: { total_cents: 5000, complete: true, missing_count: 0, items: [] },
  estimate_basis: {
    channel_fee_id: 'tiktok',
    reason: 'O app do TikTok Shop ainda não tem permissão de Finanças (código 105005).',
    items: [
      { name: 'Fone', quantity: 2, unit_price_cents: 8990, unit_cost_cents: 2500 },
      { name: 'Cabo', quantity: 1, unit_price_cents: 2000, unit_cost_cents: 0 },
    ],
  },
};

test('estima com a mesma conta da Página do Produto (por unidade) e frete/embalagem por pedido', () => {
  const fee = normalizeChannelFee('tiktok', { commissionPct: 6, fixedFeeCents: 200, taxPct: 4, otherPct: 1, shippingCents: 1500, packagingCents: 100 });
  const result = buildEstimatedMarketplaceFinancial(unavailable, fee);
  const perUnit = { ...fee, shippingCents: 0, packagingCents: 0 };
  const a = calculateChannelProfit({ priceCents: 8990, costCents: 2500, fee: perUnit });
  const b = calculateChannelProfit({ priceCents: 2000, costCents: 0, fee: perUnit });
  const commission = (a.commissionCents + a.fixedCents) * 2 + b.commissionCents + b.fixedCents;
  const taxesOther = (a.taxCents + a.otherCents) * 2 + b.taxCents + b.otherCents + 100;
  assert.equal(result.origin, 'configured_fees');
  assert.equal(result.state, 'estimated');
  assert.match(result.note, /^Estimado pelas taxas configuradas do TikTok Shop \(não é o valor real do marketplace\)\. Motivo: .*105005/);
  assert.equal(result.product_revenue_cents, 19980);
  assert.deepEqual(result.fee_lines.map((line) => [line.key, line.amount_cents]), [
    ['estimated_commission', -commission],
    ['estimated_shipping', -1500],
    ['estimated_taxes_other', -taxesOther],
  ]);
  assert.equal(result.payout_cents, 19980 - commission - 1500 - taxesOther);
  assert.equal(result.profit_cents, result.payout_cents - 5000);
  assert.ok(Math.abs(result.margin_pct - (result.profit_cents / 19980) * 100) < 1e-9);
  assert.equal(unavailable.state, 'unavailable', 'não altera o objeto original');
});

test('canal sem taxas cadastradas continua indisponível e orienta o cadastro', () => {
  const result = buildEstimatedMarketplaceFinancial({ ...unavailable, estimate_basis: { ...unavailable.estimate_basis, channel_fee_id: 'mercado_livre' } }, normalizeChannelFee('mercado_livre', null));
  assert.equal(result.state, 'unavailable');
  assert.equal(result.payout_cents, null);
  assert.match(result.note, /cadastre as taxas do Mercado Livre em "Taxas por canal"/);
});

test('valores reais, cancelados e Shopee não são estimados', () => {
  const fee = normalizeChannelFee('tiktok', { commissionPct: 6 });
  const real = { source: 'tiktok_statement', origin: 'marketplace', state: 'final', payout_cents: 100, estimate_basis: null };
  assert.equal(buildEstimatedMarketplaceFinancial(real, fee), real);
  const cancelled = { ...unavailable, state: 'cancelled', estimate_basis: null };
  assert.equal(buildEstimatedMarketplaceFinancial(cancelled, fee), cancelled);
  const shopee = { source: 'shopee_escrow', state: 'unavailable', note: 'x' };
  assert.equal(buildEstimatedMarketplaceFinancial(shopee, fee), shopee);
});

test('modal e serviço: ML/TikTok consultam o detalhe, estimam no fallback e mostram a origem', () => {
  const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
  assert.match(service, /\['shopee_mv', 'shopee_g', 'tiktok', 'mercado_livre'\]\.includes\(sale\.channel\)/);
  assert.match(service, /await import\('\.\/channelPricing'\)/);
  assert.match(service, /buildEstimatedMarketplaceFinancial\(financial, fees\[channelFeeId\]\)/);
  const panel = readFileSync('components/admin/sales/MarketplaceSaleFinancialSummary.tsx', 'utf8');
  assert.doesNotMatch(panel, /está disponível para vendas da Shopee\.'/);
  assert.match(panel, /Estimado pelas taxas configuradas/);
  assert.match(panel, /Real \$\{marketplaceName\.of\}/);
  assert.match(panel, /Lucro estimado/);
  assert.match(panel, /financial\.payout_label \|\| 'Repasse da Shopee'/);
});
