/**
 * VPS API Service — Mercado do Vale
 * Leitura: catálogo público via MySQL na VPS (com timeout e fallback silencioso).
 * Escrita: sync fire-and-forget após writes no Supabase (autenticado com X-Sync-Key).
 */

import { supabase } from './supabase';
import { buildVpsUrl, getVpsSyncHeaders } from './vpsProxyBase';

const TIMEOUT_MS = 15000; // Increased to 15s to support full catalog downloads
const PUBLIC_STOREFRONT_TIMEOUT_MS = 3500;
const WRITE_TIMEOUT_MS = 15000;
const CACHE_DURATION = 60 * 1000; // 1 min (reduzido de 5min para evitar UI stale)
const VIDEO_CHECK_CACHE_DURATION = 5 * 60 * 1000;

function proxyUrl(path: string, method: string = 'GET'): string {
  return buildVpsUrl(path, { method });
}

function isPublicStorefrontRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^\/(?:admin|pdv|auth|login)(?:\/|$)/.test(window.location.pathname);
}

function isPublicCatalogRead(path: string): boolean {
  return (
    path.startsWith('/products') ||
    path.startsWith('/categories') ||
    path.startsWith('/catalog-settings') ||
    path.startsWith('/catalog/metadata') ||
    path.startsWith('/shipping/') ||
    path.startsWith('/public/')
  );
}

function getReadTimeoutMs(path: string): number {
  return isPublicStorefrontRuntime() && isPublicCatalogRead(path)
    ? PUBLIC_STOREFRONT_TIMEOUT_MS
    : TIMEOUT_MS;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export type VpsMutationResult = {
  ok: boolean;
  id?: string;
  method?: string;
  path?: string;
  status?: number;
  statusText?: string;
  responseText?: string;
  responseJson?: unknown;
  error?: string;
};

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

export interface PdpSectionHeader {
  id: string;
  phrase: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PdpSectionHeaderInput {
  phrase: string;
  sort_order?: number;
}

class VpsApiService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private videoCheckCache = new Map<string, CacheEntry<{ exists: boolean; url?: string } | null>>();
  private videoCheckInFlight = new Map<string, Promise<{ exists: boolean; url?: string } | null>>();

  private async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...getVpsSyncHeaders(),
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
      const timer = setTimeout(() => controller.abort(), getReadTimeoutMs(path));
      
      const separator = path.includes('?') ? '&' : '?';
      const fullPath = noCache ? `${path}${separator}_t=${Date.now()}` : path;
      const headers: Record<string, string> = { Accept: 'application/json' };
      
      const res = await fetch(proxyUrl(fullPath, 'GET'), {
        signal: controller.signal,
        headers: await this.authHeaders(headers),
        cache: noCache ? 'no-store' : 'default',
      }).finally(() => {
        clearTimeout(timer);
      });
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
      const res = await fetch(proxyUrl(path, method), {
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

  private async parseMutationResponse(res: Response, method: string, path: string): Promise<VpsMutationResult> {
    const responseText = await res.text().catch(() => '');
    let responseJson: unknown;
    if (responseText) {
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = undefined;
      }
    }

    const jsonObject = responseJson && typeof responseJson === 'object' && !Array.isArray(responseJson)
      ? responseJson as Record<string, any>
      : null;

    return {
      ...(jsonObject || {}),
      ok: res.ok && jsonObject?.ok !== false,
      method,
      path,
      status: res.status,
      statusText: res.statusText,
      responseText,
      responseJson,
      error: jsonObject?.error || jsonObject?.message || (!res.ok ? `HTTP ${res.status} ${res.statusText}`.trim() : undefined),
    };
  }

  private mutationExceptionResult(method: string, path: string, error: unknown): VpsMutationResult {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido');
    return {
      ok: false,
      method,
      path,
      error: message,
    };
  }

  // ── Categories ─────────────────────────────────────────────────────────



  // ── Field Presets ──────────────────────────────────────────────────────

  async getFieldPresets(): Promise<FieldPreset[] | null> {
    return this.fetchSafe<FieldPreset[]>('/field-presets');
  }

  async createFieldPreset(data: FieldPresetInput): Promise<FieldPreset | null> {
    try {
      const res = await fetch(proxyUrl('/field-presets', 'POST'), {
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
      const res = await fetch(proxyUrl(`/field-presets/${id}`, 'PUT'), {
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
      const res = await fetch(proxyUrl(`/field-presets/${id}`, 'DELETE'), {
        method: 'DELETE',
        headers: await this.authHeaders(),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      return res.ok;
    } catch { return false; }
  }

  // ── PDP Section Headers ────────────────────────────────────────────────

  async getPdpSectionHeaders(): Promise<PdpSectionHeader[] | null> {
    return this.fetchSafe<PdpSectionHeader[]>('/pdp-section-headers');
  }

  async createPdpSectionHeader(data: PdpSectionHeaderInput): Promise<PdpSectionHeader | { error: string } | null> {
    try {
      const res = await fetch(proxyUrl('/pdp-section-headers', 'POST'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { error: json.error || `Erro ${res.status}` };
      return json;
    } catch (err: any) { return { error: err?.message || 'Erro de rede' }; }
  }

  async updatePdpSectionHeader(id: string, data: Partial<PdpSectionHeaderInput>): Promise<{ ok: true } | { error: string }> {
    try {
      const res = await fetch(proxyUrl(`/pdp-section-headers/${id}`, 'PUT'), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { error: json.error || `Erro ${res.status}` };
      return { ok: true };
    } catch (err: any) { return { error: err?.message || 'Erro de rede' }; }
  }

  async deletePdpSectionHeader(id: string): Promise<boolean> {
    try {
      const res = await fetch(proxyUrl(`/pdp-section-headers/${id}`, 'DELETE'), {
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
      const res = await fetch(proxyUrl('/products/images', 'PATCH'), {
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

  /** Busca múltiplos produtos por id em 1 round-trip (até 100 ids). */
  async getProductsByIds(ids: string[]): Promise<any[] | null> {
    if (!ids.length) return [];
    const idsParam = encodeURIComponent(ids.slice(0, 100).join(','));
    return this.fetchSafe<any[]>(`/products/by-ids?ids=${idsParam}`);
  }

  async getProductsByParentId(parentId: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products?parent_id=${encodeURIComponent(parentId)}&status=all&limit=500`, true);
  }

  async updateProductVariationGroup(parentId: string, childIds: string[]): Promise<{ ok: boolean; updated: number }> {
    const uniqueChildIds = Array.from(new Set(childIds.filter(Boolean)));
    if (!parentId || uniqueChildIds.length < 2) return { ok: false, updated: 0 };
    this.invalidateProductCache();
    this.cache.delete(`/products/${parentId}`);
    try {
      const res = await fetch(proxyUrl('/products/variation-group', 'PATCH'), {
        method: 'PATCH',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ parent_id: parentId, child_ids: uniqueChildIds }),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, updated: 0 };
      return await res.json();
    } catch (err) {
      console.warn('[vpsApiService] updateProductVariationGroup error:', err);
      return { ok: false, updated: 0 };
    }
  }

  /** Cria ou upserta um produto na VPS MySQL */
  async createProduct(data: any): Promise<{ upserted: number; errors: any[] }> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/products/batch', 'POST'), {
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

  async checkVideoBySku(sku: string): Promise<{ exists: boolean; url?: string } | null> {
    if (!sku?.trim()) return null;
    const normalizedSku = sku.trim();
    const cached = this.videoCheckCache.get(normalizedSku);
    if (cached && Date.now() - cached.timestamp <= VIDEO_CHECK_CACHE_DURATION) {
      return cached.data;
    }

    const inFlight = this.videoCheckInFlight.get(normalizedSku);
    if (inFlight) return inFlight;

    const request = this.fetchSafe<{ exists: boolean; url?: string }>(
      `/check-video?sku=${encodeURIComponent(normalizedSku)}`,
      false,
    ).then((result) => {
      this.videoCheckCache.set(normalizedSku, { data: result, timestamp: Date.now() });
      return result;
    }).finally(() => {
      this.videoCheckInFlight.delete(normalizedSku);
    });

    this.videoCheckInFlight.set(normalizedSku, request);
    return request;
  }

  // ── Units (inventário serializado) ────────────────────────────────────

  async getUnitsByProduct(productId: string, status?: string): Promise<any[] | null> {
    const qs = new URLSearchParams({ product_id: productId });
    if (status) qs.set('status', status);
    return this.fetchSafe<any[]>(`/units?${qs.toString()}`, true);
  }

  async getUnitsByOrder(orderId: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/units?order_id=${encodeURIComponent(orderId)}`, true);
  }

  async getUnitsBySale(saleId: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/units?sale_id=${encodeURIComponent(saleId)}`, true);
  }

  async getUnitByIdentifier(identifier: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/units/by-identifier/${encodeURIComponent(identifier)}`, true);
  }

  async createUnit(data: any): Promise<any | null> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/units', 'POST'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[vpsApiService] createUnit error:', err);
      return null;
    }
  }

  async createUnitsBatch(items: any[]): Promise<{ inserted: number; errors: any[] }> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/units/batch', 'POST'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(items),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return { inserted: 0, errors: [{ error: res.statusText }] };
      return await res.json();
    } catch (err: any) {
      console.error('[vpsApiService] createUnitsBatch error:', err);
      return { inserted: 0, errors: [{ error: err.message }] };
    }
  }

  async updateUnit(id: string, data: any): Promise<any | null> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl(`/units/${id}`, 'PUT'), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[vpsApiService] updateUnit error:', err);
      return null;
    }
  }

  async deleteUnit(id: string): Promise<boolean> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl(`/units/${id}`, 'DELETE'), {
        method: 'DELETE',
        headers: await this.authHeaders(),
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      return res.ok;
    } catch { return false; }
  }

  // ── WRITE (fire-and-forget após Supabase) ─────────────────────────────

  async createCombo(payload: unknown): Promise<VpsMutationResult> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/combos', 'POST'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      return this.parseMutationResponse(res, 'POST', '/combos');
    } catch (error) { return this.mutationExceptionResult('POST', '/combos', error); }
  }

  async updateCombo(id: string, payload: unknown): Promise<VpsMutationResult> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl(`/combos/${id}`, 'PUT'), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      return this.parseMutationResponse(res, 'PUT', `/combos/${id}`);
    } catch (error) { return this.mutationExceptionResult('PUT', `/combos/${id}`, error); }
  }

  async getComboChildren(id: string): Promise<any[] | null> {
    return this.fetchSafe<any[]>(`/products/${id}/combo`, true);
  }

  async getOffers(): Promise<any[]> {
    return this.fetchSafe<any[]>('/offers', true) || [];
  }

  async createOffer(payload: unknown): Promise<VpsMutationResult> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl('/offers', 'POST'), {
        method: 'POST',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      return this.parseMutationResponse(res, 'POST', '/offers');
    } catch (error) { return this.mutationExceptionResult('POST', '/offers', error); }
  }

  async updateOffer(id: string, payload: unknown): Promise<VpsMutationResult> {
    this.invalidateProductCache();
    try {
      const res = await fetch(proxyUrl(`/offers/${id}`, 'PUT'), {
        method: 'PUT',
        headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      return this.parseMutationResponse(res, 'PUT', `/offers/${id}`);
    } catch (error) { return this.mutationExceptionResult('PUT', `/offers/${id}`, error); }
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
      const response = await fetch(proxyUrl('/cart/sync', 'POST'), {
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
        const res = await fetch(proxyUrl('/products/prices-stock', 'PATCH'), {
          method: 'PATCH',
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
      const res = await fetch(proxyUrl('/products/bulk-category', 'PATCH'), {
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
    data: { ncm?: string; cest?: string; origin?: string; inmetro_certificate?: string; anatel_certificate?: string; specs?: Record<string, any> }
  ): Promise<boolean> {
    this.cache.delete(`/products/${id}`);
    this.invalidateProductCache();
    const payload: Record<string, any> = {};
    if (data.ncm !== undefined)    payload.ncm = data.ncm;
    if (data.cest !== undefined)   payload.cest = data.cest;
    if (data.origin !== undefined) payload.origin = data.origin;

    const specsPatch: Record<string, any> = { ...(data.specs ?? {}) };
    let specsTouched = false;
    if (data.inmetro_certificate !== undefined) { specsPatch.inmetro_certificate = data.inmetro_certificate; specsTouched = true; }
    if (data.anatel_certificate !== undefined)  { specsPatch.anatel_certificate = data.anatel_certificate;   specsTouched = true; }
    if (specsTouched) payload.specs = specsPatch;

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
