import { supabase } from './supabase';

export const catalogMetadataService = {
    /**
     * Buscar nomes de categorias por IDs
     */
    getCategoryNames: async (categoryIds: string[]): Promise<Map<string, string>> => {
        if (categoryIds.length === 0) return new Map();

        const { data, error } = await supabase
            .from('categories')
            .select('id, name')
            .in('id', categoryIds);

        if (error) {
            console.error('Erro ao buscar categorias:', error);
            return new Map();
        }

        return new Map((data || []).map(cat => [cat.id, cat.name]));
    },

    /**
     * Buscar todas as categorias com contagem de produtos
     */
    getAllCategories: async (): Promise<Array<{ id: string; name: string; count: number }>> => {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name');

        if (error) {
            console.error('Erro ao buscar categorias:', error);
            return [];
        }

        // Buscar contagem de produtos por categoria
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('category_id');

        if (productsError) {
            console.error('Erro ao buscar produtos:', productsError);
            return (data || []).map(cat => ({ ...cat, count: 0 }));
        }

        // Contar produtos por categoria
        const counts = new Map<string, number>();
        (products || []).forEach(p => {
            if (p.category_id) {
                counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
            }
        });

        return (data || []).map(cat => ({
            id: cat.id,
            name: cat.name,
            count: counts.get(cat.id) || 0
        }));
    },

    /**
     * Buscar todas as marcas únicas com contagem
     */
    getAllBrands: async (): Promise<Array<{ name: string; count: number }>> => {
        const { data, error } = await supabase
            .from('products')
            .select('brand');

        if (error) {
            console.error('Erro ao buscar marcas:', error);
            return [];
        }

        // Contar ocorrências de cada marca
        const counts = new Map<string, number>();
        (data || []).forEach(p => {
            if (p.brand) {
                counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
            }
        });

        return Array.from(counts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count); // Ordenar por contagem
    }
};
