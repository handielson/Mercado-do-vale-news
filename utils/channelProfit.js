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
