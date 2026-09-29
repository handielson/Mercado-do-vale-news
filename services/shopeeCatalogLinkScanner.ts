type ShopeeProductLink = {
  product_id: string;
  connection_id?: string | null;
  shopee_item_id?: number | string | null;
};

function normalizeShopeeConnectionId(value: unknown): string {
  return String(value ?? '').trim() || 'primary';
}

export interface ShopeeCatalogLinkDiscovery {
  product_id: string;
  connection_id: string;
  shopee_item_id: number;
  shopee_model_id?: number | null;
  shopee_model_sku?: string | null;
  shopee_model_name?: string | null;
  shopee_tier_index?: unknown;
  shopee_category_id?: number | null;
  shopee_price?: number | null;
  status: 'active';
  last_synced_at: string;
  local_sku: string;
  match_kind: 'item_sku' | 'model_sku';
  already_linked: boolean;
}

export interface ShopeeCatalogScanResult {
  discoveries: ShopeeCatalogLinkDiscovery[];
  remoteItemCount: number;
  unmatchedRemoteItems: Array<{ item_id: number | null; item_sku: string; item_name: string }>;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function exactSku(value: unknown): string {
  return text(value).toUpperCase();
}

function compactSku(value: unknown): string {
  return exactSku(value).replace(/[^A-Z0-9]/g, '');
}

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function priceInCents(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

export function scanShopeeCatalogLinks(args: {
  localProducts: any[];
  remoteItems: any[];
  existingLinks: ShopeeProductLink[];
  connectionId: string;
  scannedAt?: string;
}): ShopeeCatalogScanResult {
  const connectionId = normalizeShopeeConnectionId(args.connectionId);
  const scannedAt = args.scannedAt || new Date().toISOString();
  const exactMap = new Map<string, any>();
  const compactCandidates = new Map<string, any[]>();

  for (const product of Array.isArray(args.localProducts) ? args.localProducts : []) {
    const sku = exactSku(product?.sku);
    if (!sku) continue;
    if (!exactMap.has(sku)) exactMap.set(sku, product);
    const compact = compactSku(sku);
    const current = compactCandidates.get(compact) || [];
    current.push(product);
    compactCandidates.set(compact, current);
  }

  const existingKeys = new Set(
    (Array.isArray(args.existingLinks) ? args.existingLinks : [])
      .filter((link) => normalizeShopeeConnectionId(link.connection_id) === connectionId)
      .filter((link) => positiveId(link.shopee_item_id))
      .map((link) => String(link.product_id)),
  );
  const discoveries = new Map<string, ShopeeCatalogLinkDiscovery>();
  const unmatchedRemoteItems: ShopeeCatalogScanResult['unmatchedRemoteItems'] = [];

  const findLocal = (skuValue: unknown): any | null => {
    const sku = exactSku(skuValue);
    if (!sku) return null;
    const exact = exactMap.get(sku);
    if (exact) return exact;
    const compactMatches = compactCandidates.get(compactSku(sku)) || [];
    return compactMatches.length === 1 ? compactMatches[0] : null;
  };

  const addDiscovery = (item: any, model: any | null, matchKind: 'item_sku' | 'model_sku') => {
    const itemId = positiveId(item?.item_id);
    const sku = model ? model?.model_sku : item?.item_sku;
    const local = findLocal(sku);
    if (!itemId || !local?.id || !local?.sku) return false;
    const productId = String(local.id);
    const modelId = positiveId(model?.model_id);
    const price = priceInCents(model?.price_info?.[0]?.original_price ?? item?.price_info?.[0]?.original_price);
    discoveries.set(productId, {
      product_id: productId,
      connection_id: connectionId,
      shopee_item_id: itemId,
      shopee_model_id: modelId,
      shopee_model_sku: model ? text(model.model_sku) || null : null,
      shopee_model_name: model ? text(model.model_name) || null : null,
      shopee_tier_index: Array.isArray(model?.tier_index) ? model.tier_index : null,
      shopee_category_id: positiveId(item?.category_id),
      shopee_price: price,
      status: 'active',
      last_synced_at: scannedAt,
      local_sku: text(local.sku),
      match_kind: matchKind,
      already_linked: existingKeys.has(productId),
    });
    return true;
  };

  const remoteItems = Array.isArray(args.remoteItems) ? args.remoteItems : [];
  for (const item of remoteItems) {
    let matched = addDiscovery(item, null, 'item_sku');
    const models = Array.isArray(item?.models)
      ? item.models
      : Array.isArray(item?.model_list) ? item.model_list : [];
    for (const model of models) {
      matched = addDiscovery(item, model, 'model_sku') || matched;
    }
    if (!matched) {
      unmatchedRemoteItems.push({
        item_id: positiveId(item?.item_id),
        item_sku: text(item?.item_sku),
        item_name: text(item?.item_name),
      });
    }
  }

  return {
    discoveries: [...discoveries.values()],
    remoteItemCount: remoteItems.length,
    unmatchedRemoteItems,
  };
}
