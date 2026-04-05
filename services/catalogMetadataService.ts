/**
 * catalogMetadataService — Fonte única: VPS MySQL via /catalog/metadata
 *
 * Antes: 3-4 queries separadas ao Supabase (full table scans, sem cache adequado)
 * Depois: 1 chamada à VPS que executa 4 queries MySQL em paralelo com cache de 5 min
 */

const VPS_BASE_URL = (import.meta as any).env?.DEV
    ? '/vps-proxy'
    : ((import.meta as any).env?.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

interface MetadataCache {
    categories: Array<{ id: string; name: string; parent_id?: string | null; count: number; in_stock_count: number }>;
    brands: Array<{ name: string; count: number }>;
    priceRange: { min: number; max: number } | null;
    timestamp: number;
}

let metadataCache: MetadataCache | null = null;
let pendingFetch: Promise<MetadataCache | null> | null = null;

async function fetchMetadata(): Promise<MetadataCache | null> {
    // Deduplicação de requisições concorrentes
    if (pendingFetch) return pendingFetch;

    pendingFetch = (async () => {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(`${VPS_BASE_URL}/catalog/metadata`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
                cache: 'no-store',
            });
            clearTimeout(timer);
            if (!res.ok) return null;
            const data = await res.json();
            return {
                categories: data.categories || [],
                brands: data.brands || [],
                priceRange: data.priceRange || null,
                timestamp: Date.now(),
            };
        } catch {
            return null;
        } finally {
            pendingFetch = null;
        }
    })();

    return pendingFetch;
}

async function getMetadata(): Promise<MetadataCache | null> {
    // Cache fresco → retorna imediatamente
    if (metadataCache && Date.now() - metadataCache.timestamp < CACHE_TTL) {
        return metadataCache;
    }

    // SWR: se tiver cache stale, serve imediatamente e revalida em background
    if (metadataCache) {
        fetchMetadata().then(fresh => { if (fresh) metadataCache = fresh; });
        return metadataCache;
    }

    // Primeira carga: aguarda
    const fresh = await fetchMetadata();
    if (fresh) metadataCache = fresh;
    return fresh;
}

export const catalogMetadataService = {
    /**
     * Buscar nomes de categorias por IDs (mantido para compatibilidade)
     */
    getCategoryNames: async (categoryIds: string[]): Promise<Map<string, string>> => {
        if (categoryIds.length === 0) return new Map();
        const meta = await getMetadata();
        if (!meta) return new Map();
        return new Map(
            meta.categories
                .filter(c => categoryIds.includes(c.id))
                .map(c => [c.id, c.name])
        );
    },

    /**
     * Buscar todas as categorias com contagem de produtos
     * Fonte: VPS /catalog/metadata (sem Supabase)
     */
    getAllCategories: async (): Promise<Array<{ id: string; name: string; parent_id?: string | null; count: number; in_stock_count: number }>> => {
        const meta = await getMetadata();
        return meta?.categories || [];
    },

    /**
     * Buscar todas as marcas únicas com contagem
     * Fonte: VPS /catalog/metadata (sem Supabase)
     */
    getAllBrands: async (): Promise<Array<{ name: string; count: number }>> => {
        const meta = await getMetadata();
        return meta?.brands || [];
    },

    /**
     * Buscar faixa de preços (min/max) dos produtos do catálogo
     * Fonte: VPS /catalog/metadata (sem Supabase)
     */
    getPriceRange: async (): Promise<{ min: number; max: number } | null> => {
        const meta = await getMetadata();
        return meta?.priceRange || null;
    },

    /**
     * Invalida o cache local (útil após sync de produtos)
     */
    invalidateCache: () => {
        metadataCache = null;
    },
};
