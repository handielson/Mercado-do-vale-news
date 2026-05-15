const PRICE_STOCK_FIELDS = [
  'price_retail',
  'price_wholesale',
  'price_cost',
  'price_reseller',
  'price_promo',
  'promo_start',
  'promo_end',
  'stock_quantity',
  'status',
  'category_id',
  'track_inventory',
];

export function shouldFanOutBlingParentPrice({ blingId, priceRetail } = {}) {
  return Boolean(blingId) && priceRetail !== undefined && priceRetail !== null && Number.isFinite(Number(priceRetail));
}

export function buildBlingPriceTargetSkus(primarySku, childProducts = []) {
  const skus = [];
  if (typeof primarySku === 'string' && primarySku.trim()) {
    skus.push(primarySku.trim());
  }

  for (const product of childProducts || []) {
    const sku = typeof product?.sku === 'string' ? product.sku.trim() : '';
    if (sku) skus.push(sku);
  }

  return Array.from(new Set(skus));
}

export function pickBlingPriceStockUpdates(updates = {}) {
  const picked = {};
  for (const field of PRICE_STOCK_FIELDS) {
    if (updates[field] !== undefined) picked[field] = updates[field];
  }
  return picked;
}

export function buildBlingPriceStockPayload(targetSkus = [], updates = {}) {
  const commercialUpdates = pickBlingPriceStockUpdates(updates);
  return {
    products: buildBlingPriceTargetSkus('', targetSkus.map(sku => ({ sku }))).map(sku => ({
      sku,
      ...commercialUpdates,
    })),
  };
}
