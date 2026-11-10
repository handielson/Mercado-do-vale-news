// channel-profit-v1: lucro por canal de venda a partir da tabela de taxas editável (channel_fee_settings).
export const CHANNELS = [
  { id: 'site', label: 'Site / Loja' },
  { id: 'shopee_m', label: 'Shopee M' },
  { id: 'shopee_g', label: 'Shopee G' },
  { id: 'mercado_livre', label: 'Mercado Livre' },
  { id: 'tiktok', label: 'TikTok Shop' },
];

// Tabela usada hoje na tela da Shopee (20% + taxa fixa CNPJ por faixa de preço).
const SHOPEE_DEFAULT = {
  commissionPct: 20, commissionCapCents: null, fixedFeeCents: 0,
  tiers: [
    { upToCents: 7999, fixedCents: 400 },
    { upToCents: 9999, fixedCents: 1600 },
    { upToCents: 19999, fixedCents: 2000 },
    { upToCents: 49999, fixedCents: 2600 },
    { upToCents: null, fixedCents: 2800 },
  ],
  taxPct: 0, otherPct: 0, packagingCents: 0, shippingCents: 0,
};

// channel-fee-exact-v1: tabela publicada pelo TikTok Shop Brasil (vigente desde 15/07/2026):
// abaixo de R$ 50 → 10% + R$ 4 por item; a partir de R$ 50 → 6% + R$ 6 por item;
// Programa de Taxas de Envio → 6% do preço, no máximo R$ 50 por produto. Confira na Central do Vendedor.
export const TIKTOK_PUBLISHED_FEE = {
  commissionPct: 6, commissionCapCents: null, fixedFeeCents: 0,
  tiers: [
    { upToCents: 4999, fixedCents: 400, commissionPct: 10 },
    { upToCents: null, fixedCents: 600, commissionPct: 6 },
  ],
  taxPct: 0, otherPct: 0, packagingCents: 0, shippingCents: 0,
  shippingProgramPct: 6, shippingProgramCapCents: 5000,
};

export function defaultChannelFee(channel) {
  if (channel === 'shopee_m' || channel === 'shopee_g') return { ...structuredClone(SHOPEE_DEFAULT), shippingProgramPct: 0, shippingProgramCapCents: null };
  return { commissionPct: 0, commissionCapCents: null, fixedFeeCents: 0, tiers: [], taxPct: 0, otherPct: 0, packagingCents: 0, shippingCents: 0, shippingProgramPct: 0, shippingProgramCapCents: null };
}

const num = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const cents = (value) => Math.max(0, Math.round(num(value)));
const pct = (value) => Math.min(100, Math.max(0, num(value)));

export function normalizeChannelFee(channel, raw) {
  const base = defaultChannelFee(channel);
  if (!raw || typeof raw !== 'object') return base;
  const cap = raw.commissionCapCents;
  const programCap = raw.shippingProgramCapCents;
  return {
    commissionPct: pct(raw.commissionPct ?? base.commissionPct),
    commissionCapCents: cap === null || cap === undefined || cap === '' ? null : cents(cap),
    fixedFeeCents: cents(raw.fixedFeeCents),
    tiers: Array.isArray(raw.tiers) ? raw.tiers.map((tier) => ({
      upToCents: tier?.upToCents === null || tier?.upToCents === undefined || tier?.upToCents === '' ? null : cents(tier.upToCents),
      fixedCents: cents(tier?.fixedCents),
      // % da faixa; vazio = usa a comissão geral.
      commissionPct: tier?.commissionPct === null || tier?.commissionPct === undefined || tier?.commissionPct === '' ? null : pct(tier.commissionPct),
    })) : base.tiers,
    taxPct: pct(raw.taxPct),
    otherPct: pct(raw.otherPct),
    packagingCents: cents(raw.packagingCents),
    shippingCents: cents(raw.shippingCents),
    shippingProgramPct: pct(raw.shippingProgramPct),
    shippingProgramCapCents: programCap === null || programCap === undefined || programCap === '' || Number(programCap) <= 0 ? null : cents(programCap),
  };
}

export function tierForPrice(tiers, priceCents) {
  const sorted = [...(tiers || [])].sort((a, b) => (a.upToCents ?? Infinity) - (b.upToCents ?? Infinity));
  return sorted.find((item) => item.upToCents === null || item.upToCents === undefined || priceCents <= item.upToCents) || null;
}

export function tierFixedFee(tiers, priceCents) {
  const tier = tierForPrice(tiers, priceCents);
  return tier ? tier.fixedCents : 0;
}

export function isChannelFeeConfigured(fee) {
  return Boolean(fee && (fee.commissionPct > 0 || fee.fixedFeeCents > 0 || fee.tiers?.length || fee.taxPct > 0 || fee.otherPct > 0 || fee.shippingProgramPct > 0));
}

export function calculateChannelProfit({ priceCents, costCents, fee }) {
  const price = cents(priceCents);
  const cost = cents(costCents);
  const f = fee || defaultChannelFee('site');
  const tier = tierForPrice(f.tiers, price);
  const commissionPct = tier && tier.commissionPct !== null && tier.commissionPct !== undefined ? tier.commissionPct : f.commissionPct;
  let commissionCents = Math.round(price * (commissionPct / 100));
  if (f.commissionCapCents !== null && f.commissionCapCents !== undefined) commissionCents = Math.min(commissionCents, f.commissionCapCents);
  const fixedCents = (f.fixedFeeCents || 0) + (tier ? tier.fixedCents : 0);
  const taxCents = Math.round(price * (f.taxPct / 100));
  const otherCents = Math.round(price * (f.otherPct / 100));
  let shippingProgramCents = Math.round(price * ((f.shippingProgramPct || 0) / 100));
  if (f.shippingProgramCapCents !== null && f.shippingProgramCapCents !== undefined) shippingProgramCents = Math.min(shippingProgramCents, f.shippingProgramCapCents);
  const feesCents = commissionCents + fixedCents + taxCents + otherCents + shippingProgramCents + (f.packagingCents || 0) + (f.shippingCents || 0);
  const profitCents = price - cost - feesCents;
  return {
    priceCents: price, costCents: cost, commissionPct, commissionCents, fixedCents, taxCents, otherCents, shippingProgramCents,
    packagingCents: f.packagingCents || 0, shippingCents: f.shippingCents || 0,
    feesCents, netCents: price - feesCents, profitCents,
    marginPct: price > 0 ? Math.round((profitCents / price) * 10000) / 100 : 0,
  };
}

// tiktok-finance-fees-v1: sugestão para a tabela do TikTok a partir do extrato real (GET /tiktok-shop/finance/fee-summary).
// Só campos do nível do pedido (statement_transactions[].x) com total negativo (custo para a loja);
// totais agregados e campos de SKU ficam fora para não contar duas vezes.
const TOTAL_FIELD = /^(total_|net_)?(fees?|settlement|revenue|adjustment)_amount$|^total_/;
export function suggestTikTokFeesFromSummary(summary) {
  const revenue = Number(summary?.revenue_cents || 0);
  const orders = Number(summary?.orders_with_statement || 0);
  const parts = { commission: [], other: [], shipping: [] };
  const shippingTotals = {};
  for (const field of summary?.fields || []) {
    const match = /^statement_transactions\[\]\.([a-z0-9_]+)$/.exec(String(field.path || ''));
    if (!match) continue;
    const key = match[1];
    if (TOTAL_FIELD.test(key)) continue;
    const total = Number(field.total_cents) || 0;
    // tiktok-net-shipping-v1: frete entra pelo líquido (shipping_cost_amount), com subsídios; a abertura
    // (frete cheio, desconto da plataforma, frete pago pelo cliente) não pode ser somada só pelo lado negativo.
    if (/shipping|logistic|delivery/.test(key)) { shippingTotals[key] = total; continue; }
    if (!(total < 0)) continue;
    const cost = Math.abs(total);
    if (/commission/.test(key) && !/affiliate|creator|partner/.test(key)) parts.commission.push({ key, cost });
    else parts.other.push({ key, cost });
  }
  const netShipping = Object.prototype.hasOwnProperty.call(shippingTotals, 'shipping_cost_amount')
    ? { key: 'shipping_cost_amount', total: shippingTotals.shipping_cost_amount }
    : { key: 'shipping_net', total: Object.values(shippingTotals).reduce((sum, value) => sum + value, 0) };
  if (netShipping.total < 0) parts.shipping.push({ key: netShipping.key, cost: Math.abs(netShipping.total) });
  const sum = (list) => list.reduce((total, item) => total + item.cost, 0);
  const pctOf = (value) => (revenue > 0 ? Math.round((value / revenue) * 10000) / 100 : 0);
  return {
    revenueCents: revenue,
    orders,
    commissionPct: pctOf(sum(parts.commission)),
    otherPct: pctOf(sum(parts.other)),
    shippingCents: orders > 0 ? Math.round(sum(parts.shipping) / orders) : 0,
    parts,
  };
}
