import { supabase } from './supabase';
import type { CatalogProduct, FilterState } from '@/types/catalog';

// Cache simples em memória
const productCache = new Map<string, { data: CatalogProduct[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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
        pageSize: number = 20
    ): Promise<{ products: CatalogProduct[], total: number, hasMore: boolean }> => {
        const cacheKey = JSON.stringify({ filters, page, pageSize });
        const cached = productCache.get(cacheKey);

        // Retornar do cache se válido (não cachear buscas por texto)
        if (cached && !filters?.search && Date.now() - cached.timestamp < CACHE_TTL) {
            return {
                products: cached.data,
                total: cached.data.length,
                hasMore: cached.data.length === pageSize
            };
        }

        // Construir query
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' });

        // Aplicar filtros
        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`);
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
                query = query.order('price_retail', { ascending: true });
                break;
            case 'price_desc':
                query = query.order('price_retail', { ascending: false });
                break;
            case 'featured':
                query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
                break;
            case 'recent':
            default:
                query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
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

        // Resolve category slugs via separate query (FK join unreliable without formal constraint)
        const categoryIds = [...new Set(products.filter(p => p.category_id).map(p => p.category_id!))];
        if (categoryIds.length > 0) {
            const { data: catData } = await supabase
                .from('categories')
                .select('id, slug')
                .in('id', categoryIds);
            if (catData && catData.length > 0) {
                const catSlugMap = new Map<string, string>(
                    (catData as any[]).map((c: any) => [c.id, c.slug])
                );
                products = products.map(p => ({
                    ...p,
                    category_slug: catSlugMap.get(p.category_id!) || undefined,
                }));
            }
        }

        // Enrich products with model images if they have no custom images
        const productsNeedingImages = products.filter(
            p => (!p.images || p.images.length === 0) && p.model_id
        );

        if (productsNeedingImages.length > 0) {
            const modelIds = [...new Set(productsNeedingImages.map(p => p.model_id))];

            // Collect unique color names to resolve to IDs
            const colorNames = [...new Set(
                productsNeedingImages
                    .map(p => p.specs?.color)
                    .filter(Boolean) as string[]
            )];

            // Buscar imagens dos modelos e cores (se houver)
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
                // Build color name → id map
                const colorNameToId = new Map<string, string>(
                    (colorRows || []).map(c => [c.name, c.id])
                );

                products = products.map(product => {
                    if (product.images && product.images.length > 0) return product;
                    if (!product.model_id) return product;

                    const entriesForModel = modelImages.filter(mi => mi.model_id === product.model_id);
                    if (entriesForModel.length === 0) return product;

                    // Try to find the entry matching the product's color
                    const colorName = product.specs?.color;
                    const colorId = colorName ? colorNameToId.get(colorName) : undefined;

                    let chosen = colorId
                        ? entriesForModel.find(mi => mi.color_id === colorId)
                        : undefined;

                    // Fallback: use first available entry for the model
                    if (!chosen) chosen = entriesForModel[0];

                    if (chosen?.images?.length > 0) {
                        return { ...product, images: chosen.images };
                    }
                    return product;
                });
            }
        }

        // Enrich product.specs with model template_values (for badge fields like NFC, 5G etc.)
        // Only fills in fields missing from product.specs — product.specs always wins.
        const modelIdsForSpecs = [...new Set(products.filter(p => p.model_id).map(p => p.model_id!))];
        if (modelIdsForSpecs.length > 0) {
            const { data: modelTemplates } = await supabase
                .from('models')
                .select('id, template_values')
                .in('id', modelIdsForSpecs);

            if (modelTemplates && modelTemplates.length > 0) {
                const templateMap = new Map<string, Record<string, any>>(
                    modelTemplates.map((m: any) => [m.id, m.template_values || {}])
                );
                products = products.map(product => {
                    if (!product.model_id) return product;
                    const tmpl = templateMap.get(product.model_id);
                    if (!tmpl || Object.keys(tmpl).length === 0) return product;
                    // Template fills missing fields; product.specs overrides
                    const mergedSpecs = { ...tmpl, ...(product.specs || {}) };
                    return { ...product, specs: mergedSpecs };
                });
            }
        }

        // Atualizar cache
        productCache.set(cacheKey, { data: products, timestamp: Date.now() });

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
            .or(`
        name.ilike.%${query}%,
        brand.ilike.%${query}%,
        model.ilike.%${query}%
      `)
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
    getProductsByCategory: async (category: string): Promise<CatalogProduct[]> => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', category)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []) as CatalogProduct[];
    },

    /**
     * Buscar produtos em destaque
     */
    getFeaturedProducts: async (limit: number = 10): Promise<CatalogProduct[]> => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('featured', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return (data || []) as CatalogProduct[];
    },

    /**
     * Buscar produtos novos
     */
    getNewProducts: async (limit: number = 10): Promise<CatalogProduct[]> => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_new', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return (data || []) as CatalogProduct[];
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
        productCache.clear();
    },

    /**
     * Buscar categorias disponíveis (somente IDs em uso)
     */
    getCategories: async (): Promise<string[]> => {
        const { data, error } = await supabase
            .from('products')
            .select('category_id')
            .not('category_id', 'is', null);

        if (error) throw error;

        const categories = [...new Set(data?.map(p => p.category_id).filter(Boolean))];
        return categories.sort();
    },

    /**
     * Buscar lista completa de categorias com ID e Nome (útil para Selects)
     */
    getCategoriesWithNames: async (): Promise<{ id: string, name: string }[]> => {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    /**
     * Buscar marcas disponíveis
     */
    getBrands: async (): Promise<string[]> => {
        const { data, error } = await supabase
            .from('products')
            .select('brand')
            .not('brand', 'is', null);

        if (error) throw error;

        const brands = [...new Set(data?.map(p => p.brand).filter(Boolean))];
        return brands.sort();
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
