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
        // Fetch all categories
        const { data: cats, error: catsError } = await supabase
            .from('categories')
            .select('id, name')
            .order('name', { ascending: true });

        if (catsError) {
            console.error('Erro ao buscar categorias:', catsError);
            return [];
        }

        // For each category, count products via a single aggregated query
        const { data: counts, error: countsError } = await supabase
            .from('products')
            .select('category_id')
            .not('category_id', 'is', null);

        if (countsError) {
            console.error('Erro ao contar produtos:', countsError);
            return (cats || []).map(cat => ({ ...cat, count: 0 }));
        }

        // Build count map
        const countMap = new Map<string, number>();
        (counts || []).forEach(p => {
            if (p.category_id) {
                countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
            }
        });

        return (cats || []).map(cat => ({
            id: cat.id,
            name: cat.name,
            count: countMap.get(cat.id) || 0
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
