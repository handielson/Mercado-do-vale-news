/**
 * VPS API Service — Mercado do Vale
 * Leitura: catálogo público via MySQL na VPS (com timeout e fallback silencioso).
 * Escrita: sync fire-and-forget após writes no Supabase (autenticado com X-Sync-Key).
 */

const VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const TIMEOUT_MS = 3000;
const WRITE_TIMEOUT_MS = 10000;
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
        cache: noCache ? 'no-store' : 'default',
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

  private invalidateProductCache() {
    [...this.cache.keys()].filter(k => k.startsWith('/products')).forEach(k => this.cache.delete(k));
  }

  // ── READ ──────────────────────────────────────────────────────────────

  async getCategories(): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/categories');
  }

  async getProducts(params?: { category?: string; status?: string; limit?: number; offset?: number; search?: string; compact?: boolean; noCache?: boolean }): Promise<any[] | null> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.status)   qs.set('status', params.status);
    if (params?.limit)    qs.set('limit', String(params.limit));
    if (params?.offset)   qs.set('offset', String(params.offset));
    if (params?.search)   qs.set('search', params.search);
    if (params?.compact)  qs.set('compact', 'true');
    if (params?.noCache)  qs.set('_t', String(Date.now())); // Also append to URL to bust HTTP caches
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.fetchSafe<any[]>(`/products${query}`, params?.noCache);
  }

  /** Atualiza o array de imagens de um produto pelo SKU (image bank sync) */
  async updateProductImagesBySku(sku: string, images: string[]): Promise<void> {
    if (!SYNC_KEY) { console.warn('[vpsApiService] SYNC_KEY ausente'); return; }
    try {
      await fetch(`${VPS_BASE_URL}/products/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
        body: JSON.stringify({ sku, images }),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn('[vpsApiService] updateProductImagesBySku error:', err);
    }
  }


  async getProductById(id: string): Promise<any | null> {
    return this.fetchSafe<any>(`/products/${id}`);
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
    const ok = await this.writeSafe('POST', '/products/batch', products);
    console.log(`[vpsApiService] syncProducts(${products.length}) → ${ok ? 'OK' : 'FAIL'}`);
    return ok;
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

  async syncShippingSettings(settings: any): Promise<boolean> {
    this.cache.delete('/shipping/settings');
    return this.writeSafe('PATCH', '/shipping/settings', settings);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const vpsApiService = new VpsApiService();
