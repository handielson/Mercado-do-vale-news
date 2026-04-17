import { supabase } from './supabase';
import type { CatalogProduct } from '@/types/catalog';
import { vpsApiService } from '@/services/vpsApiService';
import { normalizeProduct } from '@/services/productNormalizer';
import { catalogConfigService } from '@/services/catalogConfigService';
import { VPS_PROXY_BASE } from '@/services/vpsProxyBase';


// Persistent Cache (Stale-While-Revalidate pattern)
const CACHE_TTL = 30 * 1000; // 30 segundos (evita cache obsoleto prolongado na UI)
const CACHE_KEY_PREFIX = '@mv:catalog:v7:';

// Helper to safely access localStorage (prevents SSR errors)
const getStorage = () => typeof window !== 'undefined' ? window.localStorage : null;

export const catalogService = {
    _lastVpsRaw: null as any,
    _lastMappedResult: null as any[] | null,
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

        // ── Busca com termo: vai direto ao VPS (server-side) ──────────────────
        // Isso resolve o problema de limit: 1000 esconder produtos além da 1000ª posição.
        // O VPS busca em TODOS os produtos do banco (nome, sku, ean, etc.).
        const searchTerm = filters?.search?.trim() || '';
        if (searchTerm) {
            // EAN puro (8-14 dígitos) → endpoint dedicado /products/by-ean
            if (/^\d{8,14}$/.test(searchTerm)) {
                const byEan = await vpsApiService.getProductByEan(searchTerm);
                if (byEan && byEan.length > 0) {
                    const settings = await catalogConfigService.getSettings();
                    let mapped = byEan.map(normalizeProduct) as unknown as CatalogProduct[];
                    mapped = catalogConfigService.applyVisibilityRules(mapped, settings) as unknown as CatalogProduct[];
                    return { products: mapped, total: mapped.length, hasMore: false };
                }
                return { products: [], total: 0, hasMore: false };
            }

            // Busca por texto → VPS server-side search (sem limite de 1000)
            const [vpsRaw, vpsCats, settings] = await Promise.all([
                vpsApiService.getProducts({ search: searchTerm, status: 'active', limit: 500, noCache: true }),
                vpsApiService.getCategories(),
                catalogConfigService.getSettings(),
            ]);

            if (!vpsRaw) return { products: [], total: 0, hasMore: false };

            const catSlugMap = new Map<string, string>(
                (vpsCats || []).map((c: any) => [c.id, c.slug])
            );

            let result = vpsRaw.map((p: any) => ({
                ...normalizeProduct(p),
                category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
            })) as unknown as CatalogProduct[];

            result = catalogConfigService.applyVisibilityRules(result as any, settings) as unknown as CatalogProduct[];

            const from = (page - 1) * pageSize;
            const paginated = result.slice(from, from + pageSize);
            return { products: paginated, total: result.length, hasMore: paginated.length === pageSize };
        }

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
            const useCompactPayload = true;

            // Depois da migracao de base64 para URLs HTTP na VPS, o payload compacto
            // volta a ser suficiente para os cards do catalogo.
            if (filters?.categories && filters.categories.length > 0 && !filters?.search) {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        category: filters.categories.join(','),
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 2000,
                        compact: useCompactPayload,
                    }),
                ]);
            } else {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 1000,
                        compact: useCompactPayload,
                    }),
                ]);
            }

            if (vpsRaw === null) return null;
            const settings = await catalogConfigService.getSettings();

            const catSlugMap = new Map<string, string>(
                (vpsCats || []).map((c: any) => [c.id, c.slug])
            );

            let result: any[];
            if (catalogService._lastVpsRaw === vpsRaw && catalogService._lastMappedResult) {
                // IMPORTANT: create a new array to avoid mutating the cached mapping!
                result = [...catalogService._lastMappedResult];
            } else {
                result = (vpsRaw as any[]).map((p: any) => {
                    const normalized = normalizeProduct(p);
                    
                    // Pré-calcula uma string de busca sem acentos para este produto
                    const removeAccents = (str: any) => {
                        if (!str || typeof str !== 'string') return '';
                        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    };

                    const alternativeEans = Array.isArray(p.alternative_eans)
                        ? p.alternative_eans.join(' ')
                        : (typeof p.alternative_eans === 'string' ? p.alternative_eans : '');

                    const searchStr = removeAccents(p.name) + ' ' + 
                                      removeAccents(p.brand) + ' ' + 
                                      removeAccents(p.model) + ' ' + 
                                      removeAccents(p.sku) + ' ' +
                                      removeAccents(p.ean) + ' ' +
                                      removeAccents(alternativeEans);
                    
                    return { 
                        ...normalized, 
                        category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
                        _search_string: searchStr
                     };
                });
                catalogService._lastVpsRaw = vpsRaw;
                // Save the mapped result to prevent duplicate work, but NEXT TIME clone it
                catalogService._lastMappedResult = result;
                result = [...result]; // and clone for this run as well
            }

            // Fallback de imagem para catálogo geral:
            // quando a VPS devolve images vazias, usa a galeria de modelo/cor já cadastrada.
            const productsNeedingImages = result.filter(
                (p: any) => (!Array.isArray(p.images) || p.images.length === 0) && p.model_id
            );

            if (productsNeedingImages.length > 0) {
                const modelIds = [...new Set(productsNeedingImages.map((p: any) => p.model_id))];
                const colorNames = [...new Set(
                    productsNeedingImages.map((p: any) => p.specs?.color).filter(Boolean) as string[]
                )];

                const [{ data: modelImages }, { data: colorRows }] = await Promise.all([
                    supabase
                        .from('model_color_images')
                        .select('model_id, color_id, images')
                        .in('model_id', modelIds),
                    colorNames.length > 0
                        ? supabase.from('colors').select('id, name').in('name', colorNames)
                        : Promise.resolve({ data: [] })
                ]);

                if (modelImages && modelImages.length > 0) {
                    const colorNameToId = new Map<string, string>(
                        (colorRows || []).map(c => [c.name, c.id])
                    );

                    result = result.map((product: any) => {
                        if (Array.isArray(product.images) && product.images.length > 0) return product;
                        if (!product.model_id) return product;

                        const entriesForModel = modelImages.filter(mi => mi.model_id === product.model_id);
                        if (entriesForModel.length === 0) return product;

                        const colorName = product.specs?.color;
                        const colorId = colorName ? colorNameToId.get(colorName) : undefined;
                        let chosen = colorId
                            ? entriesForModel.find(mi => mi.color_id === colorId)
                            : undefined;

                        if (!chosen) chosen = entriesForModel[0];

                        if (chosen?.images?.length > 0) {
                            return {
                                ...product,
                                images: chosen.images,
                                image_url: product.image_url || chosen.images[0]
                            };
                        }

                        return product;
                    });
                }
            }

            if (filters?.search && filters.search.trim() !== '') {
                const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const query = removeAccents(filters.search.trim());
                result = result.filter(p => (p as any)._search_string.includes(query));
            }

            // Aplica as regras globais configuradas no catálogo (estoque, inativos, preço, etc.)
            result = catalogConfigService.applyVisibilityRules(result, settings);

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

            // Em compact=true a VPS remove imagens base64 para economizar payload.
            // Para cards visíveis sem mídia, hidrata via /products/:id (payload completo).
            const hasMedia = (product: any) => {
                if (Array.isArray(product.images) && product.images.some((img: any) => typeof img === 'string' && img.trim().length > 0)) {
                    return true;
                }
                return typeof product.image_url === 'string' && product.image_url.trim().length > 0;
            };

            const missingMedia = paginated
                .filter((product: any) => product?.id && !hasMedia(product))
                .slice(0, 24);

            let hydratedPaginated = paginated;
            if (missingMedia.length > 0) {
                const fullRows = await Promise.all(
                    missingMedia.map(async (product: any) => {
                        const full = await vpsApiService.getProductById(product.id, true);
                        if (!full) return null;
                        const normalized = normalizeProduct(full as any);
                        if (!hasMedia(normalized)) return null;
                        return {
                            id: product.id,
                            images: normalized.images,
                            image_url: normalized.image_url || normalized.images?.[0] || null,
                        };
                    })
                );

                const mediaById = new Map(
                    fullRows
                        .filter(Boolean)
                        .map((row: any) => [row.id, row])
                );

                hydratedPaginated = paginated.map((product: any) => {
                    const media = mediaById.get(product.id);
                    if (!media) return product;
                    return {
                        ...product,
                        images: media.images,
                        image_url: media.image_url,
                    };
                });
            }
            return { products: hydratedPaginated as unknown as CatalogProduct[], total: result.length, hasMore: paginated.length === pageSize };
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
            const path = `/customers/${customerId}/favorites`;
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            await fetch(`${VPS_PROXY_BASE}?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
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
            const path = `/customers/${customerId}/favorites/${productId}`;
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            await fetch(`${VPS_PROXY_BASE}?path=${encodeURIComponent(path)}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
            const path = `/customers/${customerId}/favorites`;
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const res = await fetch(`${VPS_PROXY_BASE}?path=${encodeURIComponent(path)}`, {
                headers: {
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
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
