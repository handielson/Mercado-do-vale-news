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

export function defaultChannelFee(channel) {
  if (channel === 'shopee_m' || channel === 'shopee_g') return structuredClone(SHOPEE_DEFAULT);
  return { commissionPct: 0, commissionCapCents: null, fixedFeeCents: 0, tiers: [], taxPct: 0, otherPct: 0, packagingCents: 0, shippingCents: 0 };
}

const num = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const cents = (value) => Math.max(0, Math.round(num(value)));
const pct = (value) => Math.min(100, Math.max(0, num(value)));

export function normalizeChannelFee(channel, raw) {
  const base = defaultChannelFee(channel);
  if (!raw || typeof raw !== 'object') return base;
  const cap = raw.commissionCapCents;
  return {
    commissionPct: pct(raw.commissionPct ?? base.commissionPct),
    commissionCapCents: cap === null || cap === undefined || cap === '' ? null : cents(cap),
    fixedFeeCents: cents(raw.fixedFeeCents),
    tiers: Array.isArray(raw.tiers) ? raw.tiers.map((tier) => ({
      upToCents: tier?.upToCents === null || tier?.upToCents === undefined || tier?.upToCents === '' ? null : cents(tier.upToCents),
      fixedCents: cents(tier?.fixedCents),
    })) : base.tiers,
    taxPct: pct(raw.taxPct),
    otherPct: pct(raw.otherPct),
    packagingCents: cents(raw.packagingCents),
    shippingCents: cents(raw.shippingCents),
  };
}

export function tierFixedFee(tiers, priceCents) {
  const sorted = [...(tiers || [])].sort((a, b) => (a.upToCents ?? Infinity) - (b.upToCents ?? Infinity));
  const tier = sorted.find((item) => item.upToCents === null || priceCents <= item.upToCents);
  return tier ? tier.fixedCents : 0;
}

export function isChannelFeeConfigured(fee) {
  return Boolean(fee && (fee.commissionPct > 0 || fee.fixedFeeCents > 0 || fee.tiers?.length || fee.taxPct > 0 || fee.otherPct > 0));
}

export function calculateChannelProfit({ priceCents, costCents, fee }) {
  const price = cents(priceCents);
  const cost = cents(costCents);
  const f = fee || defaultChannelFee('site');
  let commissionCents = Math.round(price * (f.commissionPct / 100));
  if (f.commissionCapCents !== null && f.commissionCapCents !== undefined) commissionCents = Math.min(commissionCents, f.commissionCapCents);
  const fixedCents = (f.fixedFeeCents || 0) + tierFixedFee(f.tiers, price);
  const taxCents = Math.round(price * (f.taxPct / 100));
  const otherCents = Math.round(price * (f.otherPct / 100));
  const feesCents = commissionCents + fixedCents + taxCents + otherCents + (f.packagingCents || 0) + (f.shippingCents || 0);
  const profitCents = price - cost - feesCents;
  return {
    priceCents: price, costCents: cost, commissionCents, fixedCents, taxCents, otherCents,
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
  for (const field of summary?.fields || []) {
    const match = /^statement_transactions\[\]\.([a-z0-9_]+)$/.exec(String(field.path || ''));
    if (!match) continue;
    const key = match[1];
    if (TOTAL_FIELD.test(key) || !(Number(field.total_cents) < 0)) continue;
    const cost = Math.abs(Number(field.total_cents));
    if (/shipping|logistic|delivery/.test(key)) parts.shipping.push({ key, cost });
    else if (/commission/.test(key) && !/affiliate|creator|partner/.test(key)) parts.commission.push({ key, cost });
    else parts.other.push({ key, cost });
  }
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
