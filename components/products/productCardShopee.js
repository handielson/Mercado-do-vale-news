function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value).trim())
    .filter(Boolean);
}

function normalizePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeComparableSku(value) {
  return normalizeString(value).trim().toLowerCase();
}

export function buildShopeeProductUrl(shopId, itemId) {
  const normalizedShopId = normalizeString(shopId).trim();
  const normalizedItemId = normalizePositiveNumber(itemId);

  if (!normalizedShopId || normalizedItemId === null) return null;

  return `https://shopee.com.br/product/${encodeURIComponent(normalizedShopId)}/${normalizedItemId}`;
}

export function getShopeeButtonVisualState(product) {
  const itemId = normalizePositiveNumber(product?.shopee_item_id);

  return {
    isSynced: itemId !== null,
    itemId,
    title: itemId !== null
      ? `Produto sincronizado na Shopee (#${itemId})`
      : 'Sincronizar com Shopee',
  };
}

export function validateShopeeItemForProduct(product, shopeeItem) {
  const productSku = normalizeComparableSku(product?.sku);
  const shopeeSku = normalizeComparableSku(shopeeItem?.item_sku);

  if (productSku && shopeeSku && productSku !== shopeeSku) {
    return {
      isMatch: false,
      reason: `SKU local ${product?.sku} difere do SKU Shopee ${shopeeItem?.item_sku}`,
    };
  }

  return { isMatch: true, reason: null };
}

export function mapProductToShopeeLocalProduct(product) {
  return {
    id: String(product?.id || ''),
    name: normalizeString(product?.name),
    sku: normalizeString(product?.sku),
    images: normalizeStringArray(product?.images),
    price_retail: Number(product?.price_retail) || 0,
    price_cost: Number(product?.price_cost) || 0,
    category_slug: normalizeString(product?.category_slug),
    inmetro_certificate: normalizeString(product?.inmetro_certificate || product?.specs?.inmetro_certificate),
    ncm: normalizeString(product?.ncm),
    description: normalizeString(product?.description),
    brand: normalizeString(product?.brand),
    bling_id: product?.bling_id ?? null,
    video_url: product?.video_url ?? null,
    stock_quantity: Number(product?.stock_quantity) || 0,
    track_inventory: product?.track_inventory !== false,
    eans: normalizeStringArray(product?.eans),
    weight_kg: product?.weight_kg,
    shipping_weight: product?.shipping_weight,
    shipping_length: product?.shipping_length,
    shipping_width: product?.shipping_width,
    shipping_height: product?.shipping_height,
    dimensions: product?.dimensions || undefined,
  };
}
