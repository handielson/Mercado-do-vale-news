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
        },
        page: number = 1,
        pageSize: number = 20
    ): Promise<{ products: CatalogProduct[], total: number, hasMore: boolean }> => {
        const cacheKey = JSON.stringify({ filters, page, pageSize });
        const cached = productCache.get(cacheKey);

        // Retornar do cache se válido
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

        // Ordenação (featured primeiro)
        query = query.order('featured', { ascending: false });
        query = query.order('created_at', { ascending: false });

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

        const products = (data || []) as CatalogProduct[];

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

        return (data?.map(f => f.products) || []) as CatalogProduct[];
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
     * Buscar categorias disponíveis
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
