/**
 * VPS API Service — Mercado do Vale
 * Leitura: catálogo público via MySQL na VPS (com timeout e fallback silencioso).
 * Escrita: sync fire-and-forget após writes no Supabase (autenticado com X-Sync-Key).
 */

import { supabase } from './supabase';

const VPS_PROXY_BASE = '/api/vps-proxy';
const TIMEOUT_MS = 15000; // Increased to 15s to support full catalog downloads
const WRITE_TIMEOUT_MS = 15000;
const CACHE_DURATION = 60 * 1000; // 1 min (reduzido de 5min para evitar UI stale)

function proxyUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${VPS_PROXY_BASE}?path=${encodeURIComponent(normalized)}`;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface FieldPreset {
  id: string;
  name: string;
  description?: string;
  config: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface FieldPresetInput {
  name: string;
  description?: string;
  config: Record<string, string>;
}

class VpsApiService {
  private cache = new Map<string, CacheEntry<unknown>>();

  private async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  private isCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchSafe<T>(path: string, noCache = false): Promise<T | null> {
    if (!noCache) {
      const cached = this.isCached<T>(path);
      if (cached !== null) return cached;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const separator = path.includes('?') ? '&' : '?';
      const fullPath = `${path}${separator}_t=${Date.now()}`;
      
      const res = await fetch(proxyUrl(fullPath), {
        signal: controller.signal,
        headers: await this.authHeaders({
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }),
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      if (!noCache) {
        this.setCache<T>(path, data);
      }
      return data;
    } catch {
      return null;
    }
  }

  private async writeSafe(method: 'POST' | 'PUT' | 'DELETE' | 'PATCH', path: string, body?: unknown): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
      const hasBody = body != null;
      const res = await fetch(proxyUrl(path), {
        method,
        signal: controller.signal,
        headers: await this.authHeaders({
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          Accept: 'application/json',
        }),
        body: hasBody ? JSON.stringify(body) : undefined,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`[VPS ${method} ${path}] ${res.status} ${errorText}`.trim());
      }
      return true;
    } catch (error) {
      console.error('[vpsApiService.writeSafe] erro:', error);
      return false;
    }
  }

  invalidateProductCache() {
    [...this.cache.keys()].filter(k => k.startsWith('/products')).forEach(k => this.cache.delete(k));
  }

  // ── Categories ─────────────────────────────────────────────────────────



  // ── Field Presets ──────────────────────────────────────────────────────

  async getFieldPresets(): Promise<FieldPreset[] | null> {
    return this.fetchSafe<FieldPreset[]>('/field-presets');
  }

  async createFieldPreset(data: FieldPresetInput): Promise<FieldPreset | null> {
    try {
      const res = await fetch(proxyUrl('/field-presets'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  async updateFieldPreset(id: string, data: FieldPresetInput): Promise<boolean> {
    try {
      const res = await fetch(proxyUrl(`/field-presets/${id}`), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      return res.ok;
    } catch { return false; }
  }

  async deleteFieldPreset(id: string): Promise<boolean> {
    try {
      const res = await fetch(proxyUrl(`/field-presets/${id}`), {
        method: 'DELETE',
        headers: await this.authHeaders(),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      return res.ok;
    } catch { return false; }
  }

  // ── READ ──────────────────────────────────────────────────────────────

  async getCategories(noCache = false): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/categories', noCache);
  }

  async getCategoryCounts(): Promise<{ category_id: string; count: number; in_stock_count: number }[] | null> {
    return this.fetchSafe<{ category_id: string; count: number; in_stock_count: number }[]>('/products/category-counts');
  }


  async getProducts(params?: { category?: string; status?: string; limit?: number; offset?: number; search?: string; compact?: boolean; noCache?: boolean; parent_id?: string; sku?: string; ean?: string; model_id?: string; favoritesOnly?: boolean; customerId?: string }): Promise<any[] | null> {
    const qs = new URLSearchParams();
    if (params?.category)  qs.set('category',  params.category);
    if (params?.status)    qs.set('status',     params.status);
    if (params?.limit)     qs.set('limit',      String(params.limit));
    if (params?.offset)    qs.set('offset',     String(params.offset));
    if (params?.search)    qs.set('search',     params.search);
    if (params?.compact)   qs.set('compact',    'true');
    if (params?.parent_id) qs.set('parent_id',  params.parent_id);
    if (params?.sku)       qs.set('sku',         params.sku);
    if (params?.ean)       qs.set('ean',         params.ean);
    if (params?.model_id)  qs.set('model_id',    params.model_id);
    if (params?.favoritesOnly) qs.set('favoritesOnly', 'true');
    if (params?.customerId) qs.set('customerId', params.customerId);
    if (params?.noCache)   qs.set('_t',          String(Date.now()));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    // [DEBUG] Explicit log for search requests
    if (params?.search) {
      console.log(`[vpsApiService] getProducts sending search query: "${query}"`);
    }

    const result = await this.fetchSafe<any[]>(`/products${query}`, params?.noCache);
    
    if (params?.search) {
      console.log(`[vpsApiService] getProducts returned ${result ? result.length : 0} items for search: "${params.search}"`);
    }

    return result;
  }

  /** Atualiza o array de imagens de um produto pelo SKU (image bank sync).
   * Retorna o número de linhas afetadas. 0 = produto ainda não existe no MySQL VPS. */
  async updateProductImagesBySku(sku: string, images: string[]): Promise<number> {
    try {
      const res = await fetch(proxyUrl('/products/images'), {
        method: 'PATCH',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sku, images }),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      this.invalidateProductCache();
      if (!res.ok) return 0;
      const json = await res.json() as { ok: boolean; affectedRows?: number };
      return json.affectedRows ?? 0;
    } catch (err) {
      console.warn('[vpsApiService] updateProductImagesBySku error:', err);
      return 0;
    }
  }


  async getProductById(id: string, noCache = false): Promise<any | null> {
    return this.fetchSafe<any>(`/products/${id}`, noCache);
  }

  async getProductBySlug(slug: string): Promise<any | null> {
    return this.fetchSafe<any>(`/products/by-slug/${encodeURIComponent(slug)}`, true);
  }

  async getProductByEan(ean: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products/by-ean/${encodeURIComponent(ean)}`, true);
  }

  async getProductsByParentId(parentId: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products?parent_id=${encodeURIComponent(parentId)}&status=all&limit=500`, true);
  }

  /** Cria ou upserta um produto na VPS MySQL */
  async createProduct(data: any): Promise<{ upserted: number; errors: any[] }> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/products/batch'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify([data]),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return { upserted: 0, errors: [{ error: res.statusText }] };
      return await res.json();
    } catch (err: any) {
      console.error('[vpsApiService] createProduct error:', err);
      return { upserted: 0, errors: [{ error: err.message }] };
    }
  }

  async getBrands(): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/brands');
  }

  async getCatalogSettings(): Promise<any | null> {
    return this.fetchSafe<any>('/catalog-settings');
  }

  async getCompanySettings(): Promise<any | null> {
    return this.fetchSafe<any>('/company-settings');
  }

  async getShippingSettings(): Promise<any | null> {
    return this.fetchSafe<any>('/shipping/settings');
  }

  // ── WRITE (fire-and-forget após Supabase) ─────────────────────────────

  async createCombo(payload: unknown): Promise<{ok: boolean, id?: string}> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/combos'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch { return {ok:false}; }
  }

  async updateCombo(id: string, payload: unknown): Promise<{ok: boolean}> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl(`/combos/${id}`), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch { return {ok:false}; }
  }

  async getComboChildren(id: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products/${id}/combo`, true);
  }

  async getFavoritesRanking(limit: number = 100): Promise<any[]> {
    const res = await this.fetchSafe<any[]>(`/admin/reports/favorites-ranking?limit=${limit}`, false);
    return res || [];
  }

  async getCartsRanking(limit: number = 100): Promise<any[]> {
    const res = await this.fetchSafe<any[]>(`/admin/reports/carts-ranking?limit=${limit}`, false);
    return res || [];
  }

  async syncCart(customerId: string, items: {product_id: string, quantity: number}[]): Promise<{ok: boolean, synced?: number}> {
    try {
      const response = await fetch(proxyUrl('/cart/sync'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ customerId, items }),
      });
      if (!response.ok) return { ok: false };
      return await response.json();
    } catch {
      return { ok: false };
    }
  }

  async syncProducts(products: any[]): Promise<boolean> {
    if (!products?.length) return true;
    this.invalidateProductCache();

    const chunkSize = 1; // Limit back to 1 to prevent Fastify 413 Payload Too Large from base64 images
    let allOk = true;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const ok = await this.writeSafe('POST', '/products/batch', chunk);
      if (!ok) {
        allOk = false;
        console.warn(`[vpsApiService] Batch sync failed at chunk ${i / chunkSize}`);
      }
    }

    console.log(`[vpsApiService] syncProducts(${products.length}) → ${allOk ? 'OK' : 'FAIL (Partial)'}`);
    return allOk;
  }

  /** Envia apenas preço + estoque (sem imagens) em lotes de 50 — evita 413 e é muito mais rápido */
  async bulkSyncPricesStock(products: any[]): Promise<{ ok: boolean; sent: number }> {
    if (!products?.length) return { ok: true, sent: 0 };
    this.invalidateProductCache();

    const CHUNK = 50;
    let sent = 0;
    let allOk = true;

    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);
      try {
        const res = await fetch(proxyUrl('/products/batch'), {
          method: 'POST',
          headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
        });
        if (res.ok) {
          sent += chunk.length;
        } else {
          allOk = false;
          console.warn(`[vpsApiService] bulkSyncPricesStock chunk ${i / CHUNK} → HTTP ${res.status}`);
        }
      } catch (err) {
        allOk = false;
        console.warn('[vpsApiService] bulkSyncPricesStock error:', err);
      }
    }

    return { ok: allOk, sent };
  }

  async bulkUpdateCategory(ids: string[], category_id: string, specs?: Record<string, any>): Promise<{ ok: boolean; updated: number }> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/products/bulk-category'), {
        method: 'PATCH',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids, category_id, specs }),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, updated: 0 };
      return await res.json();
    } catch (err) {
      console.warn('[vpsApiService] bulkUpdateCategory error:', err);
      return { ok: false, updated: 0 };
    }
  }

  async updateProduct(id: string, data: any): Promise<boolean> {
    this.cache.delete(`/products/${id}`);
    this.invalidateProductCache();
    return this.writeSafe('PUT', `/products/${id}`, data);
  }

  async updateProductSeo(id: string, exclude_from_seo: boolean): Promise<boolean> {
    this.cache.delete(`/products/${id}`);
    this.invalidateProductCache();
    return this.writeSafe('PATCH', `/products/${id}/seo`, { exclude_from_seo });
  }

  /**
   * Atualiza campos fiscais do produto na VPS (fonte primária).
   * ncm: código NCM (8 dígitos, ex: "85176262")
   * cest: código CEST (7 dígitos, ex: "2100300")
   * origin: origem da mercadoria (ex: "0" = Nacional)
   * inmetro_certificate: número do certificado Inmetro (ex: "011/2024")
   *   → salvo em specs.inmetro_certificate (JSON flexível, sem schema migration)
   */
  async updateProductFiscal(
    id: string,
    data: { ncm?: string; cest?: string; origin?: string; inmetro_certificate?: string; specs?: Record<string, any> }
  ): Promise<boolean> {
    this.cache.delete(`/products/${id}`);
    this.invalidateProductCache();
    // Build payload
    const payload: Record<string, any> = {};
    if (data.ncm !== undefined)                   payload.ncm = data.ncm;
    if (data.cest !== undefined)                  payload.cest = data.cest;
    if (data.origin !== undefined)                payload.origin = data.origin;
    if (data.inmetro_certificate !== undefined)   payload.specs = { ...(data.specs ?? {}), inmetro_certificate: data.inmetro_certificate };
    return this.writeSafe('PATCH', `/products/${id}/fiscal`, payload);
  }


  async deleteProduct(id: string): Promise<boolean> {
    this.invalidateProductCache();
    return this.writeSafe('DELETE', `/products/${id}`);
  }

  async syncBrand(brand: any): Promise<boolean> {
    this.cache.delete('/brands');
    return this.writeSafe('POST', '/brands', brand);
  }

  async updateBrand(id: string, data: any): Promise<boolean> {
    this.cache.delete('/brands');
    return this.writeSafe('PUT', `/brands/${id}`, data);
  }

  async deleteBrand(id: string): Promise<boolean> {
    this.cache.delete('/brands');
    return this.writeSafe('DELETE', `/brands/${id}`);
  }

  // --- CATEGORIES SYNC ---

  async syncCategory(category: any): Promise<boolean> {
    this.cache.delete('/categories');
    return this.writeSafe('POST', '/categories', category);
  }

  async updateCategory(id: string, data: any): Promise<boolean> {
    this.cache.delete('/categories');
    return this.writeSafe('PUT', `/categories/${id}`, data);
  }

  async deleteCategory(id: string): Promise<boolean> {
    this.cache.delete('/categories');
    return this.writeSafe('DELETE', `/categories/${id}`);
  }

  async syncShippingSettings(settings: any): Promise<boolean> {
    this.cache.delete('/shipping/settings');
    return this.writeSafe('PATCH', '/shipping/settings', settings);
  }

  clearCache(): void {
    this.cache.clear();
  }

  // --- PRODUCT CATEGORIES (multi-categoria) ---

  async getProductsByCategory(categoryId: string, page = 1, limit = 20): Promise<{
    items: Array<{
      id: string; name: string; sku: string; brand: string;
      category_id: string; status: string; price_retail: number;
      stock_quantity: number; thumbnail: string | null; is_primary_category: boolean;
    }>;
    total: number; page: number; limit: number; hasMore: boolean;
  }> {
    const path = `/products/by-category/${categoryId}?page=${page}&limit=${limit}`;
    const result = await this.fetchSafe<{
      items: any[]; total: number; page: number; limit: number; hasMore: boolean;
    }>(path, true); // noCache=true para dados administrativos
    if (!result) throw new Error('Falha ao carregar produtos da categoria');
    return result;
  }

  async addProductCategory(productId: string, categoryId: string): Promise<boolean> {
    return this.writeSafe('POST', '/product-categories', { product_id: productId, category_id: categoryId });
  }

  async removeProductCategory(productId: string, categoryId: string): Promise<boolean> {
    return this.writeSafe('DELETE', `/product-categories/${productId}/${categoryId}`);
  }

  async moveProductCategory(productId: string, categoryId: string): Promise<boolean> {
    // Atualiza categoria principal e remove da tabela extra automaticamente
    return this.writeSafe('PATCH', `/products/${productId}/category`, { category_id: categoryId });
  }
}

export const vpsApiService = new VpsApiService();

