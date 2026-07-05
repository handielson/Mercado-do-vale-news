const DEFAULT_TIKTOK_SHOP_AUTH_MARKET = 'ROW';

const SELLER_AUTH_ORIGINS = {
  US: 'https://services.us.tiktokshop.com',
  ROW: 'https://services.tiktokshop.com',
};

export function normalizeTikTokShopMarket(value) {
  const market = String(value || '').trim().toUpperCase();
  return market === 'US' ? 'US' : DEFAULT_TIKTOK_SHOP_AUTH_MARKET;
}

/**
 * @param {{ serviceId?: string | number | null, state?: string | null, market?: string | null }} [options]
 * @returns {string}
 */
export function buildTikTokShopSellerAuthUrl({
  serviceId,
  state,
  market = DEFAULT_TIKTOK_SHOP_AUTH_MARKET,
} = {}) {
  const cleanServiceId = String(serviceId || '').trim();
  if (!cleanServiceId) return '';

  const origin = SELLER_AUTH_ORIGINS[normalizeTikTokShopMarket(market)];
  const url = new URL('/open/authorize', origin);
  url.searchParams.set('service_id', cleanServiceId);

  const cleanState = String(state || '').trim();
  if (cleanState) url.searchParams.set('state', cleanState);

  return url.toString();
}
