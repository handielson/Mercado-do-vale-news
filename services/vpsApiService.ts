/**
 * VPS API Service — Mercado do Vale
 * Leitura: catálogo público via MySQL na VPS (com timeout e fallback silencioso).
 * Escrita: sync fire-and-forget após writes no Supabase (autenticado com X-Sync-Key).
 */

const VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const TIMEOUT_MS = 15000; // Increased to 15s to support full catalog downloads
const WRITE_TIMEOUT_MS = 15000;
const CACHE_DURATION = 5 * 60 * 1000;
const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class VpsApiService {
  private cache = new Map<string, CacheEntry<unknown>>();

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
      const res = await fetch(`${VPS_BASE_URL}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store', // Sempre ignora cache nativo HTTP para usar o nosso in-memory this.cache
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
    if (!SYNC_KEY) {
      console.warn('[vpsApiService] VITE_VPS_SYNC_KEY não configurado');
      return false;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
      const res = await fetch(`${VPS_BASE_URL}${path}`, {
        method,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Sync-Key': SYNC_KEY },
        body: body != null ? JSON.stringify(body) : undefined,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  invalidateProductCache() {
    [...this.cache.keys()].filter(k => k.startsWith('/products')).forEach(k => this.cache.delete(k));
  }

  // ── READ ──────────────────────────────────────────────────────────────

  async getCategories(): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/categories');
  }

  async getProducts(params?: { category?: string; status?: string; limit?: number; offset?: number; search?: string; compact?: boolean; noCache?: boolean; parent_id?: string; sku?: string; ean?: string; model_id?: string }): Promise<any[] | null> {
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
    if (params?.noCache)   qs.set('_t',          String(Date.now()));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.fetchSafe<any[]>(`/products${query}`, params?.noCache);
  }

  /** Atualiza o array de imagens de um produto pelo SKU (image bank sync).
   * Retorna o número de linhas afetadas. 0 = produto ainda não existe no MySQL VPS. */
  async updateProductImagesBySku(sku: string, images: string[]): Promise<number> {
    if (!SYNC_KEY) { console.warn('[vpsApiService] SYNC_KEY ausente'); return 0; }
    try {
      const res = await fetch(`${VPS_BASE_URL}/products/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
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
    if (!SYNC_KEY) { console.warn('[vpsApiService] SYNC_KEY ausente'); return { upserted: 0, errors: [] }; }
    this.invalidateProductCache();
    try {
      const res = await fetch(`${VPS_BASE_URL}/products/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
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
    if (!SYNC_KEY) { console.warn('[vpsApiService] SYNC_KEY ausente'); return {ok:false}; }
    this.invalidateProductCache();
    try {
      const res = await fetch(`${VPS_BASE_URL}/combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Sync-Key': SYNC_KEY },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch { return {ok:false}; }
  }

  async updateCombo(id: string, payload: unknown): Promise<{ok: boolean}> {
    if (!SYNC_KEY) { console.warn('[vpsApiService] SYNC_KEY ausente'); return {ok:false}; }
    this.invalidateProductCache();
    try {
      const res = await fetch(`${VPS_BASE_URL}/combos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Sync-Key': SYNC_KEY },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch { return {ok:false}; }
  }

  async getComboChildren(id: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products/${id}/combo`, true);
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
}

export const vpsApiService = new VpsApiService();
