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
            if (error.code !== '20' && !error.message?.includes('aborted')) {
                console.error('Erro ao buscar categorias:', error);
            }
            return new Map();
        }

        return new Map((data || []).map(cat => [cat.id, cat.name]));
    },

    /**
     * Buscar todas as categorias com contagem de produtos
     * Counts vêm da VPS (fonte primária); fallback para Supabase se a VPS falhar.
     */
    getAllCategories: async (): Promise<Array<{ id: string; name: string; parent_id?: string | null; count: number }>> => {
        // Fetch all categories (from Supabase — tem parent_id, sort_order, etc.)
        const { data: cats, error: catsError } = await supabase
            .from('categories')
            .select('id, name, parent_id, sort_order')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (catsError) {
            if (catsError.code !== '20' && !catsError.message?.includes('aborted')) {
                console.error('Erro ao buscar categorias:', catsError);
            }
            return [];
        }

        const countMap = new Map<string, number>();

        // Sempre faz a contagem pelo Supabase como base de garantia
        const { data: counts, error: countsError } = await supabase
            .from('products')
            .select('category_id, status, stock_quantity')
            .not('category_id', 'is', null);

        if (!countsError) {
            (counts || []).forEach(p => {
                if (p.category_id) {
                    // Soma +1 para o fallback
                    countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
                }
            });
        }

        // Tentar contar produtos pela VPS (fonte primária) para substituir/somar a contagem
        try {
            const { vpsApiService } = await import('./vpsApiService');
            const vpsCounts = await vpsApiService.getCategoryCounts();

            if (vpsCounts && vpsCounts.length > 0) {
                // Atualiza/Sobrescreve com os valores da VPS onde existirem
                vpsCounts.forEach(row => {
                    if (row.category_id) {
                        const vpsCount = Number(row.count) || 0;
                        // Usa o maior valor entre VPS e Supabase para evitar ocultar categoria por erro de sincronização
                        const currentCount = countMap.get(row.category_id) || 0;
                        countMap.set(row.category_id, Math.max(currentCount, vpsCount));
                    }
                });
            }
        } catch (err) {
            console.error('Erro ao buscar contagens de categoria da VPS:', err);
        }

        return (cats || []).map(cat => ({
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
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
            if (error.code !== '20' && !error.message?.includes('aborted')) {
                console.error('Erro ao buscar marcas:', error);
            }
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
    },

    /**
     * Buscar faixa de preços (min/max) dos produtos do catálogo
     */
    getPriceRange: async (): Promise<{ min: number; max: number } | null> => {
        const { data, error } = await supabase
            .from('products')
            .select('price_retail')
            .not('price_retail', 'is', null)
            .gt('price_retail', 0);

        if (error || !data || data.length === 0) return null;

        const prices = data.map(p => p.price_retail as number);
        return {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
    }
};
