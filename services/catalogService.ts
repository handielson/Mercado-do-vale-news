import { supabase } from './supabase';
import type { CatalogProduct } from '@/types/catalog';
import { catalogConfigService } from '@/services/catalogConfigService';
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

        // 1. STALE: Try to return instantly from LocalStorage
        if (!bypassCache && !filters?.search) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        // Serve staled cache instantly, but still proceed to fetch and revalidate in background IF TTL expired
                        if (Date.now() - cached.timestamp < CACHE_TTL) {
                            console.log('⚡ [catalogService] Serving from persistent cache (Fresh)');
                            return {
                                products: cached.data,
                                total: cached.total,
                                hasMore: cached.hasMore
                            };
                        } else {
                            // It's stale - we COULD return it here for instant SWR, but for critical e-comm data 
                            // we usually prefer letting TTL control freshness, or we return now and trigger async fetch via React Query.
                            // Since we are not using React Query, we will just let it fetch normally if expired.
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse catalog cache', e);
                }
            }
        }

        console.log(`🌐 [catalogService] Iniciando busca de produtos (bypassCache: ${bypassCache})`);

        // ── 100% VPS API PATH ──────────────────────────────────────────────────
        // P1: busca categorias e produtos em PARALELO (antes era sequencial → -200-400ms)
        try {
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


                if (vpsRaw !== null) {
                    const rawSettings = await catalogConfigService.getSettings();
                    // No caminho VPS, desativamos filtros que dependem de dados que podem
                    // estar incompletos na VPS (preço e estoque podem estar apenas no Supabase).
                    const settings = {
                        ...rawSettings,
                        hide_zero_price: false,   // VPS pode ter preço 0; o preço real está no Supabase
                        hide_out_of_stock: rawSettings.hide_out_of_stock && !filters?.inStockOnly 
                            ? false  // Não filtramos estoque na VPS (combos têm stock=0 na VPS)
                            : false,
                    };
                    console.log('[catalogService] Settings aplicados no caminho VPS:', 
                        { hide_zero_price: settings.hide_zero_price, hide_out_of_stock: settings.hide_out_of_stock, hide_inactive: settings.hide_inactive });

                    // Category slug map from VPS
                    const catSlugMap = new Map<string, string>(
                        (vpsCats || []).map((c: any) => [c.id, c.slug])
                    );

                    // Apply visibility rules + multi-category filter client-side
                    let result = (vpsRaw as any[]).map((p: any) => {
                        const normalized = normalizeProduct(p);
                        return {
                            ...normalized,
                            category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
                        };
                    });

                    console.log(`[catalogService] Total de produtos brutos da VPS antes de filtros: ${result.length}`);
                    if (result.length > 0) {
                        // Fazemos um log do primeiro e do KB-SCLS caso exista
                        const comboTest = result.find(c => c.sku === 'KB-SCLS' || c.name?.includes('SCLS'));
                        if (comboTest) console.log('[catalogService] Exemplo de Produto Combo (KB-SCLS) Mapeado:', comboTest);
                        // Log diagnóstico de campos de preço na VPS
                        const zeroPriceExample = result.find(p => (p.price_retail || 0) <= 0);
                        const positivePriceExample = result.find(p => (p.price_retail || 0) > 0);
                        if (zeroPriceExample) {
                            const raw = (vpsRaw as any[]).find(p => p.id === zeroPriceExample.id);
                            console.log('[catalogService] 🔎 Produto com preço 0 — campos de preço brutos da VPS:', 
                                { id: raw?.id, sku: raw?.sku, price: raw?.price, price_retail: raw?.price_retail, 
                                  preco: raw?.preco, preco_venda: raw?.preco_venda, preco_varejo: raw?.preco_varejo });
                        }
                        if (positivePriceExample) {
                            const raw = (vpsRaw as any[]).find(p => p.id === positivePriceExample.id);
                            console.log('[catalogService] ✅ Produto com preço > 0 — campos de preço brutos da VPS:', 
                                { id: raw?.id, sku: raw?.sku, price: raw?.price, price_retail: raw?.price_retail, 
                                  preco: raw?.preco, preco_venda: raw?.preco_venda, preco_varejo: raw?.preco_varejo });
                        }
                    }

                    // Client-side Text Search Filter (Fallback in case VPS API doesn't filter perfectly)
                    if (filters?.search && filters.search.trim() !== '') {
                        const query = filters.search.toLowerCase().trim();
                        const lenBefore = result.length;
                        result = result.filter(p => 
                            (p.name && p.name.toLowerCase().includes(query)) ||
                            (p.brand && p.brand.toLowerCase().includes(query)) ||
                            ((p as any).model && (p as any).model.toLowerCase().includes(query)) ||
                            (p.sku && p.sku.toLowerCase().includes(query)) ||
                            (p.description && typeof p.description === 'string' && p.description.toLowerCase().includes(query))
                        );
                        console.log(`[catalogService] Ocultados por text search ("${query}"): ${lenBefore - result.length}`);
                    }

                    if (settings.hide_inactive && !filters?.search) {
                         const lenBefore = result.length;
                         result = result.filter(p => p.status === 'active');
                         console.log(`[catalogService] Ocultados inativos: ${lenBefore - result.length}`);
                    }

                    if (settings.hide_out_of_stock || filters?.inStockOnly) {
                        const lenBefore = result.length;
                        result = result.filter(p => {
                            const keep = !p.track_inventory || (p.stock_quantity || 0) > 0;
                            return keep;
                        });
                        console.log(`[catalogService] Ocultados por falta de estoque (track_inventory + <= 0): ${lenBefore - result.length}`);
                    }
                    if (settings.hide_zero_price) {
                        const lenBefore = result.length;
                        // Combos (is_combo=1) nunca são filtrados por preço zero — seu preço é calculado
                        result = result.filter(p => {
                            const keep = (p as any).is_combo === 1 || (p as any).is_combo === true || (p.price_retail || 0) > 0;
                            return keep;
                        });
                        console.log(`[catalogService] Ocultados por preço 0: ${lenBefore - result.length}`);
                    }
                    if (settings.min_stock_to_show > 0) {
                        const lenBefore = result.length;
                        result = result.filter(p => {
                            const keep = !p.track_inventory || (p.stock_quantity || 0) >= settings.min_stock_to_show;
                            return keep;
                        });
                        console.log(`[catalogService] Ocultados por estoque min_stock_to_show (${settings.min_stock_to_show}): ${lenBefore - result.length}`);
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

                    // Client-side sort
                    switch (filters?.sortBy) {
                        case 'price_asc':  result.sort((a, b) => (a.price_retail || 0) - (b.price_retail || 0)); break;
                        case 'price_desc': result.sort((a, b) => (b.price_retail || 0) - (a.price_retail || 0)); break;
                        default:
                            // recent / featured: newest first (images-first for display)
                            result.sort((a, b) => {
                                const dateA = new Date((a as any).created_at || 0).getTime();
                                const dateB = new Date((b as any).created_at || 0).getTime();
                                return dateB - dateA;
                            });
                    }

                    // Client-side pagination
                    const from = (page - 1) * pageSize;
                    const paginated = result.slice(from, from + pageSize);

                    console.log(`⚡ [catalogService] VPS served ${paginated.length}/${result.length} products`);
                    return { products: paginated as unknown as CatalogProduct[], total: result.length, hasMore: paginated.length === pageSize };
                }
            } catch (vpsErr) {
                console.error('[catalogService] VPS API hard failure:', vpsErr);
                throw new Error('Falha ao conectar com o serviço de catálogo integrado.');
            }
        
        // Se a VPS retornou explicitamente null ou falhou (e não usamos bypassCache), 
        // retorna vazio.
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
