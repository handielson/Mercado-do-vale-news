import { supabase } from './supabase';
import type { CatalogProduct } from '@/types/catalog';
import { vpsApiService } from '@/services/vpsApiService';
import { normalizeProduct } from '@/services/productNormalizer';


// Persistent Cache (Stale-While-Revalidate pattern)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (Para revalidação silenciosa)
const CACHE_KEY_PREFIX = '@mv:catalog:';

// Helper to safely access localStorage (prevents SSR errors)
const getStorage = () => typeof window !== 'undefined' ? window.localStorage : null;

export const catalogService = {
    /**
     * Buscar produtos do catálogo com filtros
     */
    getProducts: async (
        filters?: {
            search?: string;
            categories?: string[];
            brands?: string[];
            priceRange?: [number, number];
            inStockOnly?: boolean;
            featuredOnly?: boolean;
            newOnly?: boolean;
            favoritesOnly?: boolean;
            customerId?: string;
            sortBy?: 'recent' | 'price_asc' | 'price_desc' | 'featured';
        },
        page: number = 1,
        pageSize: number = 20,
        bypassCache: boolean = false
    ): Promise<{ products: CatalogProduct[], total: number, hasMore: boolean }> => {
        const cacheKey = `${CACHE_KEY_PREFIX}products:${JSON.stringify({ filters, page, pageSize })}`;

        // Helper para salvar no cache
        const saveToCache = (products: any[], total: number, hasMore: boolean) => {
            if (filters?.search) return; // Buscas não são cacheadas
            const storage = getStorage();
            if (!storage) return;
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: products, total, hasMore, timestamp: Date.now() }));
            } catch (e) {
                // quota exceeded — ignora silenciosamente
            }
        };

        // Helper para buscar da VPS
        const fetchFromVps = async () => {
            let vpsRaw: any = null;
            let vpsCats: any[] = [];

            if (filters?.categories && filters.categories.length > 0 && !filters?.search) {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        category: filters.categories.join(','),
                        search: filters?.search,
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 2000,
                    }),
                ]);
            } else {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        search: filters?.search,
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 1000,
                    }),
                ]);
            }

            if (vpsRaw === null) return null;

            const settings = {
                hide_inactive: true,
                hide_zero_price: false,
                hide_out_of_stock: false,
                min_stock_to_show: 0,
            };

            const catSlugMap = new Map<string, string>(
                (vpsCats || []).map((c: any) => [c.id, c.slug])
            );

            let result = (vpsRaw as any[]).map((p: any) => {
                const normalized = normalizeProduct(p);
                return { ...normalized, category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined };
            });

            if (filters?.search && filters.search.trim() !== '') {
                const query = filters.search.toLowerCase().trim();
                result = result.filter(p =>
                    (p.name && p.name.toLowerCase().includes(query)) ||
                    (p.brand && p.brand.toLowerCase().includes(query)) ||
                    ((p as any).model && (p as any).model.toLowerCase().includes(query)) ||
                    (p.sku && p.sku.toLowerCase().includes(query)) ||
                    (p.description && typeof p.description === 'string' && p.description.toLowerCase().includes(query))
                );
            }

            if (settings.hide_inactive && !filters?.search) {
                result = result.filter(p => p.status === 'active');
            }
            if (filters?.inStockOnly) {
                result = result.filter(p => !p.track_inventory || (p.stock_quantity || 0) > 0);
            }
            if (filters?.categories && filters.categories.length > 1) {
                result = result.filter(p => p.category_id && filters.categories!.includes(p.category_id));
            }
            if (filters?.brands && filters.brands.length > 0) {
                result = result.filter(p => p.brand && filters.brands!.includes(p.brand));
            }
            if (filters?.priceRange) {
                result = result.filter(p => (p.price_retail || 0) >= filters.priceRange![0] && (p.price_retail || 0) <= filters.priceRange![1]);
            }
            if (filters?.featuredOnly) {
                result = result.filter(p => p.custom_fields && typeof p.custom_fields === 'object' && 'featured' in p.custom_fields && p.custom_fields.featured === true);
            }

            switch (filters?.sortBy) {
                case 'price_asc':  result.sort((a, b) => (a.price_retail || 0) - (b.price_retail || 0)); break;
                case 'price_desc': result.sort((a, b) => (b.price_retail || 0) - (a.price_retail || 0)); break;
                default:
                    result.sort((a, b) => {
                        const dateA = new Date((a as any).created_at || 0).getTime();
                        const dateB = new Date((b as any).created_at || 0).getTime();
                        return dateB - dateA;
                    });
            }

            const from = (page - 1) * pageSize;
            const paginated = result.slice(from, from + pageSize);
            return { products: paginated as unknown as CatalogProduct[], total: result.length, hasMore: paginated.length === pageSize };
        };

        // ── SWR (Stale-While-Revalidate) ──────────────────────────────────────
        // 1. Verificar cache localStorage
        if (!bypassCache && !filters?.search) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        const isStale = Date.now() - cached.timestamp >= CACHE_TTL;

                        if (!isStale) {
                            // Cache fresco → retorna instantaneamente
                            console.log('⚡ [catalogService] Cache fresco — retornando instantaneamente');
                            return { products: cached.data, total: cached.total, hasMore: cached.hasMore };
                        } else {
                            // Cache stale → serve imediatamente e revalida em background
                            console.log('⚡ [catalogService] Cache stale — servindo imediatamente, revalidando em background');
                            fetchFromVps().then(fresh => {
                                if (fresh) saveToCache(fresh.products, fresh.total, fresh.hasMore);
                            }).catch(() => {});
                            return { products: cached.data, total: cached.total, hasMore: cached.hasMore };
                        }
                    }
                } catch (e) {
                    console.warn('[catalogService] Failed to parse catalog cache', e);
                }
            }
        }

        // 2. Sem cache → busca da VPS e salva
        console.log(`🌐 [catalogService] Buscando da VPS (bypassCache: ${bypassCache})`);
        try {
            const fresh = await fetchFromVps();
            if (fresh) {
                saveToCache(fresh.products, fresh.total, fresh.hasMore);
                console.log(`⚡ [catalogService] VPS: ${fresh.products.length}/${fresh.total} produtos`);
                return fresh;
            }
        } catch (vpsErr) {
            console.error('[catalogService] VPS falhou:', vpsErr);
            throw new Error('Falha ao conectar com o serviço de catálogo integrado.');
        }

        return { products: [], total: 0, hasMore: false };
    },


    /**
     * Buscar produtos por texto
     */
    searchProducts: async (query: string): Promise<CatalogProduct[]> => {
        if (query.length < 2) return [];
        // VPS é a fonte de verdade — Supabase products descontinuado para catálogo
        const results = await vpsApiService.getProducts({ search: query, limit: 50, noCache: true });
        return (results || []).map(normalizeProduct) as unknown as CatalogProduct[];
    },

    /**
     * Buscar produto por ID
     */
    getProductById: async (id: string): Promise<CatalogProduct | null> => {
        // VPS é a fonte de verdade — Supabase products descontinuado para catálogo
        const product = await vpsApiService.getProductById(id, true);
        if (!product) return null;
        // Registrar visualização (Supabase analytics — ok manter)
        await catalogService.recordProductView(id);
        return normalizeProduct(product) as unknown as CatalogProduct;
    },

    /**
     * Buscar produtos por categoria
     */
    getProductsByCategory: async (category: string, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}category:${category}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — Supabase products descontinuado para catálogo
        const results = await vpsApiService.getProducts({ category, limit: 200 });
        const products = (results || []).map(normalizeProduct) as unknown as CatalogProduct[];
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Buscar produtos em destaque
     */
    getFeaturedProducts: async (limit: number = 10, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}featured:${limit}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — busca produtos em destaque
        const VPS_URL = (import.meta as any).env?.DEV
            ? '/vps-proxy'
            : ((import.meta as any).env?.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');
        let products: CatalogProduct[] = [];
        try {
            const res = await fetch(`${VPS_URL}/products?is_featured=true&limit=${limit}`);
            if (res.ok) {
                const data = await res.json();
                products = (data || []).map(normalizeProduct) as unknown as CatalogProduct[];
            }
        } catch (e) { console.warn('[catalogService] getFeaturedProducts VPS error:', e); }
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Buscar produtos novos
     */
    getNewProducts: async (limit: number = 10, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}new:${limit}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — busca produtos novos
        const VPS_URL = (import.meta as any).env?.DEV
            ? '/vps-proxy'
            : ((import.meta as any).env?.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');
        let products: CatalogProduct[] = [];
        try {
            const res = await fetch(`${VPS_URL}/products?is_new=true&limit=${limit}`);
            if (res.ok) {
                const data = await res.json();
                products = (data || []).map(normalizeProduct) as unknown as CatalogProduct[];
            }
        } catch (e) { console.warn('[catalogService] getNewProducts VPS error:', e); }
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Registrar visualização de produto
     */
    recordProductView: async (productId: string, customerId?: string): Promise<void> => {
        const sessionId = localStorage.getItem('session_id') || crypto.randomUUID();
        localStorage.setItem('session_id', sessionId);

        await supabase.from('product_views').insert({
            product_id: productId,
            customer_id: customerId,
            session_id: sessionId
        });

        // Atualizar contador no produto
        await supabase.rpc('increment_product_views', { product_id: productId });
    },

    /**
     * Adicionar aos favoritos
     */
    addToFavorites: async (productId: string, customerId: string): Promise<void> => {
        try {
            const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';
            const VPS_URL = 'https://api.xiaomipetrolina.com.br';
            await fetch(`${VPS_URL}/customers/${customerId}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
                body: JSON.stringify({ productId }),
            });
        } catch (error: any) {
            console.error('Error adding to favorites:', error);
            throw error;
        }
    },

    /**
     * Remover dos favoritos
     */
    removeFromFavorites: async (productId: string, customerId: string): Promise<void> => {
        try {
            const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';
            const VPS_URL = 'https://api.xiaomipetrolina.com.br';
            await fetch(`${VPS_URL}/customers/${customerId}/favorites/${productId}`, {
                method: 'DELETE',
                headers: { 'X-Sync-Key': SYNC_KEY },
            });
        } catch (error: any) {
            console.error('Error removing from favorites:', error);
            throw error;
        }
    },

    /**
     * Buscar IDs dos produtos favoritos do usuário
     */
    getUserFavorites: async (customerId: string): Promise<string[]> => {
        try {
            const VPS_URL = 'https://api.xiaomipetrolina.com.br';
            const res = await fetch(`${VPS_URL}/customers/${customerId}/favorites`, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return [];
            const data = await res.json();
            // Pode retornar array de IDs ou array de objetos { product_id }
            if (Array.isArray(data)) {
                return data.map((item: any) => (typeof item === 'string' ? item : item.product_id)).filter(Boolean);
            }
            return [];
        } catch (error: any) {
            console.error('Error getting favorites:', error);
            return [];
        }
    },

    /**
     * Verificar se produto está nos favoritos
     */
    isFavorite: async (productId: string, customerId: string): Promise<boolean> => {
        try {
            const favs = await catalogService.getUserFavorites(customerId);
            return favs.includes(productId);
        } catch (error: any) {
            console.error('Error checking favorite:', error);
            return false;
        }
    },

    /**
     * Limpar cache
     */
    clearCache: () => {
        const storage = getStorage();
        if (storage) {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                    storage.removeItem(key);
                }
            }
        }
    },

    /**
     * Buscar categorias disponíveis (somente IDs em uso)
     */
    getCategories: async (): Promise<string[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}categories_used`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                }
            } catch (e) { }
        }
        // VPS é a fonte de verdade para categorias
        const cats = await vpsApiService.getCategories();
        const result = [...new Set((cats || []).map((c: any) => c.id).filter(Boolean))].sort() as string[];
        if (storage) {
            try { storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() })); } catch (e) { }
        }
        return result;
    },

    /**
     * Buscar lista completa de categorias com ID e Nome (útil para Selects)
     */
    getCategoriesWithNames: async (): Promise<{ id: string, name: string }[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}categories_full`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) {
                        return cached.data;
                    }
                }
            } catch (e) { }
        }

        const { data, error } = await supabase
            .from('categories')
            .select('id, name')
            .order('name');

        if (error) throw error;
        const result = data || [];

        if (storage) {
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
            } catch (e) { }
        }

        return result;
    },

    /**
     * Buscar marcas disponíveis
     */
    getBrands: async (): Promise<string[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}brands_used`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                }
            } catch (e) { }
        }
        // VPS é a fonte de verdade — extrai marcas únicas dos produtos
        const vpsProducts = await vpsApiService.getProducts({ limit: 2000, compact: true });
        const result = [...new Set((vpsProducts || []).map((p: any) => p.brand).filter(Boolean))].sort() as string[];
        if (storage) {
            try { storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() })); } catch (e) { }
        }
        return result;
    }
};

// Função RPC para incrementar views (criar no Supabase)
/*
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET 
    views_count = COALESCE(views_count, 0) + 1,
    last_viewed_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
