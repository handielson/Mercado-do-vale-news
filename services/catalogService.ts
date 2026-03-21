import { supabase } from './supabase';
import type { CatalogProduct, FilterState } from '@/types/catalog';
import { catalogConfigService } from '@/services/catalogConfigService';
import { vpsApiService } from '@/services/vpsApiService';

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

        console.log(`🌐 [catalogService] Fetching from Supabase (bypassCache: ${bypassCache})`);

        // ── VPS API FAST PATH ──────────────────────────────────────────────────
        // Use for simple queries: no text search, no brands, no price range, no special flags.
        // Products from MySQL already include images; category slugs come from /categories.
        const isSimpleQuery = !filters?.search
            && (!filters?.brands || filters.brands.length === 0)
            && !filters?.priceRange
            && !filters?.inStockOnly
            && !filters?.featuredOnly
            && !filters?.newOnly;

        if (isSimpleQuery) {
            try {
                const [vpsRaw, vpsCats] = await Promise.all([
                    vpsApiService.getProducts({
                        status: 'active',
                        // send a single category id if filtered, otherwise fetch all
                        category: filters?.categories?.length === 1 ? filters.categories[0] : undefined,
                        limit: 1000,
                    }),
                    vpsApiService.getCategories(),
                ]);

                if (vpsRaw !== null) {
                    const settings = await catalogConfigService.getSettings();

                    // Category slug map from VPS
                    const catSlugMap = new Map<string, string>(
                        (vpsCats || []).map((c: any) => [c.id, c.slug])
                    );

                    // Apply visibility rules + multi-category filter client-side
                    let result = (vpsRaw as CatalogProduct[]).map(p => ({
                        ...p,
                        category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
                    }));

                    if (settings.hide_out_of_stock) result = result.filter(p => (p.stock_quantity || 0) > 0);
                    if (settings.hide_zero_price)   result = result.filter(p => (p.price_retail || 0) > 0);
                    if (settings.min_stock_to_show > 0) result = result.filter(p => (p.stock_quantity || 0) >= settings.min_stock_to_show);
                    if (filters?.categories && filters.categories.length > 1) {
                        result = result.filter(p => p.category_id && filters.categories!.includes(p.category_id));
                    }

                    // Client-side sort
                    switch (filters?.sortBy) {
                        case 'price_asc':  result.sort((a, b) => (a.price_retail || 0) - (b.price_retail || 0)); break;
                        case 'price_desc': result.sort((a, b) => (b.price_retail || 0) - (a.price_retail || 0)); break;
                        default:
                            // recent / featured: newest first (images-first for display)
                            result.sort((a, b) => {
                                const dateA = new Date(a.created_at || 0).getTime();
                                const dateB = new Date(b.created_at || 0).getTime();
                                return dateB - dateA;
                            });
                    }

                    // Client-side pagination
                    const from = (page - 1) * pageSize;
                    const paginated = result.slice(from, from + pageSize);

                    console.log(`⚡ [catalogService] VPS served ${paginated.length}/${result.length} products`);
                    return { products: paginated, total: result.length, hasMore: paginated.length === pageSize };
                }
            } catch (vpsErr) {
                console.warn('[catalogService] VPS API failed, falling back to Supabase:', vpsErr);
            }
        }
        // ── END VPS FAST PATH ─────────────────────────────────────────────────

        // Construir query - Trocado exact por estimated para evitar Full Table Scan e gargalo na contagem de linhas
        let query = supabase
            .from('products')
            .select('*', { count: 'estimated' });

        // Get global catalog settings to apply DB-level filtering BEFORE pagination
        const settings = await catalogConfigService.getSettings();

        // Aplicar regras de visibilidade globais
        if (settings.hide_inactive) {
            query = query.eq('status', 'active');
        } else {
            // Default rule: always filter active to avoid desperate slots unless disabled
            query = query.eq('status', 'active');
        }

        if (settings.hide_out_of_stock) {
            query = query.gt('stock_quantity', 0);
        }

        if (settings.hide_zero_price) {
            query = query.gt('price_retail', 0);
        }

        if (settings.min_stock_to_show && settings.min_stock_to_show > 0) {
            query = query.gte('stock_quantity', settings.min_stock_to_show);
        }

        // Aplicar filtros
        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
        }

        // IMPORTANTE: Só aplicar filtro de categoria se houver categorias selecionadas
        // Se o array estiver vazio, não aplicar o filtro (mostrar todos os produtos)
        if (filters?.categories && filters.categories.length > 0) {
            query = query.in('category_id', filters.categories);
        }

        if (filters?.brands && filters.brands.length > 0) {
            query = query.in('brand', filters.brands);
        }

        if (filters?.priceRange) {
            query = query
                .gte('price_retail', filters.priceRange[0])
                .lte('price_retail', filters.priceRange[1]);
        }

        if (filters?.inStockOnly) {
            query = query.gt('stock_quantity', 0);
        }

        if (filters?.featuredOnly) {
            query = query.eq('featured', true);
        }

        if (filters?.newOnly) {
            query = query.eq('is_new', true);
        }

        // Paginação
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        // Ordenação dinâmica
        switch (filters?.sortBy) {
            case 'price_asc':
                query = query.order('price_retail', { ascending: true }).order('name', { ascending: true });
                break;
            case 'price_desc':
                query = query.order('price_retail', { ascending: false }).order('name', { ascending: true });
                break;
            case 'featured':
                query = query.order('featured', { ascending: false }).order('created_at', { ascending: false }).order('name', { ascending: true });
                break;
            case 'recent':
            default:
                query = query.order('featured', { ascending: false }).order('created_at', { ascending: false }).order('name', { ascending: true });
                break;
        }

        const { data, error, count } = await query;

        console.log('[catalogService] Supabase Response:', {
            data,
            error,
            count,
            filters,
            hasData: !!data,
            dataLength: data?.length
        });

        if (error) throw error;

        let products = (data || []) as CatalogProduct[];

        // Extrai identificadores únicos necessários para as consultas de enriquecimento
        const categoryIds = [...new Set(products.filter(p => p.category_id).map(p => p.category_id!))];
        const productsNeedingImages = products.filter(p => (!p.images || p.images.length === 0) && p.model_id);
        const modelIdsForImages = [...new Set(productsNeedingImages.map(p => p.model_id!))];
        const colorNames = [...new Set(productsNeedingImages.map(p => p.specs?.color).filter(Boolean) as string[])];
        const modelIdsForSpecs = [...new Set(products.filter(p => p.model_id).map(p => p.model_id!))];

        // Dispara todas as consultas de enriquecimento em paralelo
        const [
            catResponse,
            modelImagesResponse,
            colorRowsResponse,
            modelTemplatesResponse
        ] = await Promise.all([
            categoryIds.length > 0
                ? supabase.from('categories').select('id, slug').in('id', categoryIds)
                : Promise.resolve({ data: [] }),
            modelIdsForImages.length > 0
                ? supabase.from('model_color_images').select('model_id, color_id, images').in('model_id', modelIdsForImages)
                : Promise.resolve({ data: [] }),
            colorNames.length > 0
                ? supabase.from('colors').select('id, name').in('name', colorNames)
                : Promise.resolve({ data: [] }),
            modelIdsForSpecs.length > 0
                ? supabase.from('models').select('id, template_values').in('id', modelIdsForSpecs)
                : Promise.resolve({ data: [] })
        ]);

        // Processa categorias
        if (catResponse.data && catResponse.data.length > 0) {
            const catSlugMap = new Map<string, string>(
                (catResponse.data as any[]).map((c: any) => [c.id, c.slug])
            );
            products = products.map(p => ({
                ...p,
                category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
            }));
        }

        // Processa cores e imagens
        if (modelImagesResponse.data && modelImagesResponse.data.length > 0) {
            const colorNameToId = new Map<string, string>(
                (colorRowsResponse.data || []).map(c => [c.name, c.id])
            );
            
            products = products.map(product => {
                if (product.images && product.images.length > 0) return product;
                if (!product.model_id) return product;

                const entriesForModel = (modelImagesResponse.data as any[]).filter(mi => mi.model_id === product.model_id);
                if (entriesForModel.length === 0) return product;

                const colorName = product.specs?.color;
                const colorId = colorName ? colorNameToId.get(colorName) : undefined;
                let chosen = colorId ? entriesForModel.find(mi => mi.color_id === colorId) : undefined;
                
                if (!chosen) chosen = entriesForModel[0]; // fallback
                if (chosen?.images?.length > 0) {
                    return { ...product, images: chosen.images };
                }
                return product;
            });
        }

        // Processa templates de modelo (Specs complementares)
        if (modelTemplatesResponse.data && modelTemplatesResponse.data.length > 0) {
            const templateMap = new Map<string, Record<string, any>>(
                (modelTemplatesResponse.data as any[]).map((m: any) => [m.id, m.template_values || {}])
            );
            products = products.map(product => {
                if (!product.model_id) return product;
                const tmpl = templateMap.get(product.model_id);
                if (!tmpl || Object.keys(tmpl).length === 0) return product;
                
                const mergedSpecs = { ...tmpl, ...(product.specs || {}) };
                return { ...product, specs: mergedSpecs };
            });
        }

        // Atualizar cache
        if (!filters?.search) {
            const storage = getStorage();
            if (storage) {
                try {
                    // Caching the entire product list per category/filter easily hits the 5MB localStorage limit.
                    // We only cache the result if it's a very light payload, or we rely on browser memory/React Query.
                    // Disabled local storage persistence for large product arrays to avoid QuotaExceededError. 
                } catch (e) {
                    console.warn('Failed to save catalog to cache (storage full?)', e);
                }
            }
        }

        return {
            products,
            total: count || 0,
            hasMore: products.length === pageSize
        };
    },

    /**
     * Buscar produtos por texto
     */
    searchProducts: async (query: string): Promise<CatalogProduct[]> => {
        if (query.length < 2) return [];

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%,sku.ilike.%${query}%`)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return (data || []) as CatalogProduct[];
    },

    /**
     * Buscar produto por ID
     */
    getProductById: async (id: string): Promise<CatalogProduct | null> => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        // Registrar visualização
        await catalogService.recordProductView(id);

        return data as CatalogProduct;
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
                        if (Date.now() - cached.timestamp < CACHE_TTL) {
                            return cached.data;
                        }
                    }
                } catch (e) { }
            }
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', category)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .order('id', { ascending: true });

        if (error) throw error;

        const products = (data || []) as CatalogProduct[];

        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() }));
                } catch (e) { }
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
                        if (Date.now() - cached.timestamp < CACHE_TTL) {
                            return cached.data;
                        }
                    }
                } catch (e) { }
            }
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('featured', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const products = (data || []) as CatalogProduct[];

        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() }));
                } catch (e) { }
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
                        if (Date.now() - cached.timestamp < CACHE_TTL) {
                            return cached.data;
                        }
                    }
                } catch (e) { }
            }
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_new', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const products = (data || []) as CatalogProduct[];

        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() }));
                } catch (e) { }
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
        const { error } = await supabase
            .from('customer_favorites')
            .insert({
                product_id: productId,
                customer_id: customerId
            });

        if (error && error.code !== '23505') { // Ignorar duplicatas
            throw error;
        }
    },

    /**
     * Remover dos favoritos
     */
    removeFromFavorites: async (productId: string, customerId: string): Promise<void> => {
        const { error } = await supabase
            .from('customer_favorites')
            .delete()
            .eq('product_id', productId)
            .eq('customer_id', customerId);

        if (error) throw error;
    },

    /**
     * Buscar favoritos do usuário
     */
    getUserFavorites: async (customerId: string): Promise<CatalogProduct[]> => {
        const { data, error } = await supabase
            .from('customer_favorites')
            .select('product_id, products(*)')
            .eq('customer_id', customerId);

        if (error) throw error;

        return (data?.map(f => f.products) || []) as unknown as CatalogProduct[];
    },

    /**
     * Verificar se produto está nos favoritos
     */
    isFavorite: async (productId: string, customerId: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('customer_favorites')
            .select('id')
            .eq('product_id', productId)
            .eq('customer_id', customerId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return !!data;
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
                    if (Date.now() - cached.timestamp < CACHE_TTL) {
                        return cached.data;
                    }
                }
            } catch (e) { }
        }

        const { data, error } = await supabase
            .from('products')
            .select('category_id')
            .not('category_id', 'is', null);

        if (error) throw error;

        const categories = [...new Set(data?.map(p => p.category_id).filter(Boolean))];
        const result = categories.sort();

        if (storage) {
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
            } catch (e) { }
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
                    if (Date.now() - cached.timestamp < CACHE_TTL) {
                        return cached.data;
                    }
                }
            } catch (e) { }
        }

        const { data, error } = await supabase
            .from('products')
            .select('brand')
            .not('brand', 'is', null);

        if (error) throw error;

        const brands = [...new Set(data?.map(p => p.brand).filter(Boolean))];
        const result = brands.sort();

        if (storage) {
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
            } catch (e) { }
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
