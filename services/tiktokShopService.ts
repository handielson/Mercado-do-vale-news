import { vpsClient } from './vpsClient';

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

  getProductLinks(productIds: string[]): Promise<{ links: TikTokShopProductLink[] }> {
    const ids = Array.from(new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (ids.length === 0) return Promise.resolve({ links: [] });
    return vpsClient.get(
      `/tiktok-shop/products/links?product_ids=${encodeURIComponent(ids.slice(0, 100).join(','))}`,
    );
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
