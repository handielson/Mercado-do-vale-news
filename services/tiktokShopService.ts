import { vpsClient } from './vpsClient';

export const TIKTOK_PRODUCT_LINKS_UPDATED_EVENT = 'mdv:tiktok-shop-product-links-updated';
export const TIKTOK_PRODUCT_LINKS_UPDATED_STORAGE_KEY = 'mdv:tiktok-shop-product-links-updated-at';

export function notifyTikTokProductLinksUpdated(productIds: string[]) {
  if (typeof window === 'undefined') return;
  const detail = {
    product_ids: Array.from(new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))),
    updated_at: Date.now(),
  };

  try {
    window.localStorage.setItem(TIKTOK_PRODUCT_LINKS_UPDATED_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // A atualizacao local continua funcionando mesmo com o storage indisponivel.
  }
  window.dispatchEvent(new CustomEvent(TIKTOK_PRODUCT_LINKS_UPDATED_EVENT, { detail }));
}

export interface TikTokShopSafeStatus {
  configured: boolean;
  connected: boolean;
  app_key: string | null;
  app_secret_configured: boolean;
  service_id: string | null;
  redirect_url: string;
  shop_cipher_configured: boolean;
  seller_name: string | null;
  seller_base_region: string | null;
  open_id_masked: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  granted_scopes: string[];
}

export interface TikTokAuthorizedShopSummary {
  name: string | null;
  region: string | null;
  seller_type: string | null;
  code: string | null;
}

export interface TikTokAuthorizedShopsResponse {
  count: number;
  shops: TikTokAuthorizedShopSummary[];
  status: TikTokShopSafeStatus;
}

export interface TikTokShopCategorySummary {
  id: string;
  parent_id: string | null;
  name: string;
  is_leaf: boolean;
  permission_statuses: string[];
}

export interface TikTokShopCategoryReadiness {
  category: TikTokShopCategorySummary;
  rules: Record<string, unknown>;
  attributes: Array<Record<string, any>>;
  required_attributes: Array<Record<string, any>>;
  request_ids: {
    rules: string | null;
    attributes: string | null;
  };
}

export interface TikTokShopProductLink {
  product_id: string;
  tiktok_product_id: string;
  tiktok_sku_id: string | null;
  status: string | null;
  last_synced_at: string | null;
  video_uploaded?: boolean;
}

export interface TikTokShopPublishResponse extends TikTokShopProductLink {
  ok: boolean;
  already_active?: boolean;
  already_pending?: boolean;
  request_id: string | null;
}

export interface TikTokShopCategoryMapping {
  local_category_id: string;
  tiktok_category_id: string;
  tiktok_category_name: string;
  updated_at: string | null;
}

export interface TikTokShopWarehouseSummary {
  id: string;
  name: string;
  effect_status: string;
  type: string;
  is_default: boolean;
}

export interface TikTokShopDraftResponse {
  ok: boolean;
  already_exists?: boolean;
  product_id: string;
  tiktok_product_id: string;
  tiktok_sku_id: string | null;
  status: string;
  request_id: string | null;
  video_uploaded: boolean;
  notice: string | null;
}

export type TikTokShopDraftStepStatus = 'idle' | 'running' | 'done' | 'skipped' | 'error';

export interface TikTokShopDraftJobStep {
  key: string;
  label: string;
  status: TikTokShopDraftStepStatus;
  detail: string;
  updated_at: string | null;
}

export interface TikTokShopDraftJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  product_id: string;
  steps: TikTokShopDraftJobStep[];
  result: TikTokShopDraftResponse | null;
  error: {
    message: string;
    code: string | number | null;
    request_id: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface TikTokShopDraftInput {
  product_id: string;
  category_id: string;
  category_name: string;
  warehouse_id: string;
}

export const tiktokShopService = {
  getStatus(): Promise<TikTokShopSafeStatus> {
    return vpsClient.get<TikTokShopSafeStatus>('/tiktok-shop/settings');
  },

  updateSettings(input: {
    app_key?: string | null;
    app_secret?: string | null;
    service_id?: string | null;
  }): Promise<TikTokShopSafeStatus> {
    return vpsClient.patch<TikTokShopSafeStatus>('/tiktok-shop/settings', input);
  },

  getAuthorizationUrl(): Promise<{ url: string; redirect_url: string; market: string }> {
    return vpsClient.get<{ url: string; redirect_url: string; market: string }>(
      '/tiktok-shop/oauth/auth',
    );
  },

  refreshAuthorizedShops(): Promise<TikTokAuthorizedShopsResponse> {
    return vpsClient.get<TikTokAuthorizedShopsResponse>('/tiktok-shop/shops');
  },

  getCategories(keyword = ''): Promise<{
    count: number;
    categories: TikTokShopCategorySummary[];
    request_id: string | null;
  }> {
    const query = keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
    return vpsClient.get(`/tiktok-shop/catalog/categories${query}`);
  },

  getCategoryReadiness(categoryId: string): Promise<TikTokShopCategoryReadiness> {
    return vpsClient.get(
      `/tiktok-shop/catalog/categories/${encodeURIComponent(categoryId)}/readiness`,
    );
  },

  getCategoryMapping(localCategoryId: string): Promise<{ mapping: TikTokShopCategoryMapping | null }> {
    return vpsClient.get(
      `/tiktok-shop/catalog/category-mappings/${encodeURIComponent(localCategoryId)}`,
    );
  },

  saveCategoryMapping(input: {
    local_category_id: string;
    tiktok_category_id: string;
    tiktok_category_name: string;
  }): Promise<{ mapping: TikTokShopCategoryMapping }> {
    return vpsClient.put(
      `/tiktok-shop/catalog/category-mappings/${encodeURIComponent(input.local_category_id)}`,
      {
        tiktok_category_id: input.tiktok_category_id,
        tiktok_category_name: input.tiktok_category_name,
      },
    );
  },

  getWarehouses(): Promise<{
    count: number;
    warehouses: TikTokShopWarehouseSummary[];
    request_id: string | null;
  }> {
    return vpsClient.get('/tiktok-shop/logistics/warehouses');
  },

  createDraft(input: TikTokShopDraftInput): Promise<TikTokShopDraftResponse> {
    return vpsClient.post('/tiktok-shop/products/drafts', input);
  },

  startDraftJob(input: TikTokShopDraftInput): Promise<TikTokShopDraftJob> {
    return vpsClient.post('/tiktok-shop/products/draft-jobs', input);
  },

  getDraftJob(jobId: string): Promise<TikTokShopDraftJob> {
    return vpsClient.get(
      `/tiktok-shop/products/draft-jobs/${encodeURIComponent(jobId)}`,
    );
  },

  getProductStatus(productId: string): Promise<TikTokShopProductLink & { request_id?: string | null }> {
    return vpsClient.get(
      `/tiktok-shop/products/${encodeURIComponent(productId)}/status`,
    );
  },

  publishDraft(productId: string): Promise<TikTokShopPublishResponse> {
    return vpsClient.post(
      `/tiktok-shop/products/${encodeURIComponent(productId)}/publish`,
      {},
    );
  },

  async getProductLinks(productIds: string[]): Promise<{ links: TikTokShopProductLink[] }> {
    const ids = Array.from(new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (ids.length === 0) return { links: [] };

    const batches: string[][] = [];
    for (let index = 0; index < ids.length; index += 100) {
      batches.push(ids.slice(index, index + 100));
    }
    const responses = await Promise.all(batches.map((batch) =>
      vpsClient.get<{ links: TikTokShopProductLink[] }>(
        `/tiktok-shop/products/links?product_ids=${encodeURIComponent(batch.join(','))}`,
      ),
    ));
    const linksByProductId = new Map<string, TikTokShopProductLink>();
    responses.flatMap((response) => response.links || []).forEach((link) => {
      if (link.product_id) linksByProductId.set(link.product_id, link);
    });
    return { links: Array.from(linksByProductId.values()) };
  },

  updatePrice(input: {
    product_id: string;
    sku_id: string;
    amount_cents: number;
    currency?: string;
  }): Promise<{
    ok: boolean;
    product_id: string;
    sku_id: string;
    amount_cents: number;
    currency: string;
    request_id: string | null;
  }> {
    return vpsClient.post('/tiktok-shop/products/price', input);
  },
};
