/**
 * VPS API Service — Mercado do Vale
 * Busca dados do MySQL na VPS com timeout e fallback silencioso.
 * Usar apenas para operações de LEITURA do catálogo público.
 */

const VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const TIMEOUT_MS = 3000; // 3 segundos
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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

  /**
   * Faz fetch com timeout. Retorna null em caso de erro (não lança exceção).
   */
  private async fetchSafe<T>(path: string): Promise<T | null> {
    const cacheKey = path;
    const cached = this.isCached<T>(cacheKey);
    if (cached !== null) return cached;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${VPS_BASE_URL}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = (await res.json()) as T;
      this.setCache<T>(cacheKey, data);
      return data;
    } catch {
      // Timeout ou falha de rede — retorna null silenciosamente
      return null;
    }
  }

  /** Buscar categorias do catálogo */
  async getCategories(): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/categories');
  }

  /** Buscar produtos do catálogo */
  async getProducts(params?: {
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<any[] | null> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.status)   qs.set('status', params.status);
    if (params?.limit)    qs.set('limit', String(params.limit));
    if (params?.offset)   qs.set('offset', String(params.offset));
    if (params?.search)   qs.set('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.fetchSafe<any[]>(`/products${query}`);
  }

  /** Buscar produto por ID */
  async getProductById(id: string): Promise<any | null> {
    return this.fetchSafe<any>(`/products/${id}`);
  }

  /** Buscar marcas */
  async getBrands(): Promise<any[] | null> {
    return this.fetchSafe<any[]>('/brands');
  }

  /** Buscar configurações do catálogo */
  async getCatalogSettings(): Promise<any | null> {
    return this.fetchSafe<any>('/catalog-settings');
  }

  /** Buscar configurações da empresa */
  async getCompanySettings(): Promise<any | null> {
    return this.fetchSafe<any>('/company-settings');
  }

  /** Limpar cache manualmente */
  clearCache(): void {
    this.cache.clear();
  }
}

export const vpsApiService = new VpsApiService();
