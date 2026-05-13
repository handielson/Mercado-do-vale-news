import type {
  ShopeeLinkedLocalProduct,
  ShopeeModelListRow,
  ShopeeVariationLinkMatch,
} from '../types/shopee-variation-link';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function cleanSku(value: unknown): string {
  return clean(value).toUpperCase();
}

function numericId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function findExistingShopeeItemIdForGroup(
  products: ShopeeLinkedLocalProduct[],
  product: ShopeeLinkedLocalProduct,
): number | null {
  const groupKey = clean(product.parent_id || product.id);
  if (!groupKey) return null;

  const siblings = products.filter((candidate) => {
    if (clean(candidate.id) === clean(product.id)) return true;
    return clean(candidate.parent_id || candidate.id) === groupKey;
  });

  for (const sibling of siblings) {
    const itemId = numericId(sibling.shopee_item_id);
    if (itemId) return itemId;
  }

  return null;
}

export function matchShopeeModelsBySku(
  products: ShopeeLinkedLocalProduct[],
  modelList: ShopeeModelListRow[],
): Map<string, ShopeeVariationLinkMatch> {
  const bySku = new Map<string, ShopeeModelListRow>();
  for (const model of modelList) {
    const sku = cleanSku(model.model_sku);
    if (sku && !bySku.has(sku)) bySku.set(sku, model);
  }

  const matches = new Map<string, ShopeeVariationLinkMatch>();
  for (const product of products) {
    const sku = cleanSku(product.sku);
    const model = sku ? bySku.get(sku) : null;
    const modelId = model ? numericId(model.model_id) : null;
    if (!model || !modelId) continue;

    matches.set(product.id, {
      product_id: product.id,
      shopee_model_id: modelId,
      shopee_model_sku: clean(model.model_sku),
      shopee_model_name: clean(model.model_name) || null,
      shopee_tier_index: Array.isArray(model.tier_index) ? model.tier_index : null,
    });
  }

  return matches;
}

export function getMissingShopeeVariationSkus(
  products: ShopeeLinkedLocalProduct[],
  modelList: ShopeeModelListRow[],
): string[] {
  const publishedSkus = new Set(modelList.map((model) => cleanSku(model.model_sku)).filter(Boolean));
  return products
    .map((product) => clean(product.sku))
    .filter((sku) => sku && !publishedSkus.has(cleanSku(sku)));
}

export function mergeShopeeModelIdsBySku<T extends Record<string, any>>(
  requestedModelList: T[],
  existingModelList: ShopeeModelListRow[],
): T[] {
  const existingBySku = new Map<string, ShopeeModelListRow>();
  for (const model of Array.isArray(existingModelList) ? existingModelList : []) {
    const sku = cleanSku(model.model_sku);
    if (sku && !existingBySku.has(sku)) existingBySku.set(sku, model);
  }

  return requestedModelList.map((model) => {
    const sku = cleanSku(model.model_sku);
    const existing = sku ? existingBySku.get(sku) : null;
    const modelId = existing ? numericId(existing.model_id) : null;
    return modelId ? { ...model, model_id: modelId } : model;
  });
}

export function shouldInitTierVariationForExistingItem(
  existingModelList: ShopeeModelListRow[],
  requestedProducts: ShopeeLinkedLocalProduct[],
): boolean {
  const requestedSkuCount = requestedProducts.map((product) => cleanSku(product.sku)).filter(Boolean).length;
  if (requestedSkuCount <= 1) return false;
  if (!Array.isArray(existingModelList) || existingModelList.length <= 1) return true;
  return false;
}
