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
