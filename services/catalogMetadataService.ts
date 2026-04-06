const VPS_BASE_URL = (import.meta as any).env?.DEV
    ? '/vps-proxy'
    : ((import.meta as any).env?.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');

const CACHE_TTL = 30 * 1000; // 30 segundos (evita ficar muito tempo com stale data na UI)

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
            
            // Bypass completo de cache de CDN e Browser
            const timestamp = Date.now();
            const res = await fetch(`${VPS_BASE_URL}/catalog/metadata?_t=${timestamp}`, {
                signal: controller.signal,
                headers: { 
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
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

    // Primeira carga ou expirado (bloqueia e traz fresco em vez de stale pra n ter flicker)
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
     * Fonte de Nomes: Supabase | Fonte de Contagem: VPS
     */
    getAllCategories: async (): Promise<Array<{ id: string; name: string; parent_id?: string | null; count: number; in_stock_count: number }>> => {
        try {
            // VPS é a única fonte de verdade para categorias
            const timestamp = Date.now();
            const [catsRes, countsRes] = await Promise.all([
                fetch(`${VPS_BASE_URL}/categories?_t=${timestamp}`, {
                    headers: { 'Cache-Control': 'no-cache, no-store' }, cache: 'no-store'
                }),
                fetch(`${VPS_BASE_URL}/products/category-counts?_t=${timestamp}`, {
                    headers: { 'Cache-Control': 'no-cache, no-store' }, cache: 'no-store'
                }),
            ]);

            if (!catsRes.ok) {
                const meta = await getMetadata();
                return meta?.categories || [];
            }

            const cats: any[] = await catsRes.json();
            const rawCounts: any[] = countsRes.ok ? await countsRes.json() : [];

            const countMap = new Map(rawCounts.map(c => [c.category_id, { count: Number(c.count) || 0, in_stock_count: Number(c.in_stock_count) || 0 }]));

            return cats.map(c => ({
                id: c.id,
                name: c.name,
                parent_id: c.parent_id || null,
                count: countMap.get(c.id)?.count || 0,
                in_stock_count: countMap.get(c.id)?.in_stock_count || 0,
            }));
        } catch(e) {
            console.error('Erro getAllCategories:', e);
            const meta = await getMetadata();
            return meta?.categories || [];
        }
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
