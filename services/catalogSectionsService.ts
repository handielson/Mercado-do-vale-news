import { supabase } from './supabase';
import type { CatalogSection, CreateSectionData, UpdateSectionData, SectionType } from '@/types/catalogSections';
import type { CatalogProduct } from '@/types/catalog';

class CatalogSectionsService {
    private cache: Map<string, { data: CatalogSection[]; timestamp: number }> = new Map();
    private cacheDuration = 5 * 60 * 1000; // 5 minutos

    // ==================== CRUD ====================

    /**
     * Buscar todas as seções do usuário
     */
    async getSections(userId?: string): Promise<CatalogSection[]> {
        try {
            const cacheKey = `sections_${userId || 'current'}`;
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                return cached.data;
            }

            let query = supabase
                .from('catalog_sections')
                .select('*')
                .order('display_order', { ascending: true });

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const sections = (data || []) as CatalogSection[];
            this.cache.set(cacheKey, { data: sections, timestamp: Date.now() });

            return sections;
        } catch (error) {
            console.error('Erro ao buscar seções:', error);
            throw error;
        }
    }

    /**
     * Buscar seções ativas (habilitadas)
     */
    async getActiveSections(userId?: string): Promise<CatalogSection[]> {
        const sections = await this.getSections(userId);
        return sections.filter(s => s.is_enabled);
    }

    /**
     * Buscar uma seção específica
     */
    async getSection(id: string): Promise<CatalogSection> {
        try {
            const { data, error } = await supabase
                .from('catalog_sections')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as CatalogSection;
        } catch (error) {
            console.error('Erro ao buscar seção:', error);
            throw error;
        }
    }

    /**
     * Criar nova seção
     */
    async createSection(sectionData: CreateSectionData): Promise<CatalogSection> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { data, error } = await supabase
                .from('catalog_sections')
                .insert({
                    ...sectionData,
                    user_id: user.id
                })
                .select()
                .single();

            if (error) throw error;

            this.clearCache();
            return data as CatalogSection;
        } catch (error) {
            console.error('Erro ao criar seção:', error);
            throw error;
        }
    }

    /**
     * Atualizar seção existente
     */
    async updateSection(id: string, updates: Partial<UpdateSectionData>): Promise<CatalogSection> {
        try {
            const { data, error } = await supabase
                .from('catalog_sections')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            this.clearCache();
            return data as CatalogSection;
        } catch (error) {
            console.error('Erro ao atualizar seção:', error);
            throw error;
        }
    }

    /**
     * Deletar seção
     */
    async deleteSection(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('catalog_sections')
                .delete()
                .eq('id', id);

            if (error) throw error;
            this.clearCache();
        } catch (error) {
            console.error('Erro ao deletar seção:', error);
            throw error;
        }
    }

    /**
     * Reordenar seções
     */
    async reorderSections(sectionIds: string[]): Promise<void> {
        try {
            const updates = sectionIds.map((id, index) =>
                supabase
                    .from('catalog_sections')
                    .update({ display_order: index })
                    .eq('id', id)
            );

            await Promise.all(updates);
            this.clearCache();
        } catch (error) {
            console.error('Erro ao reordenar seções:', error);
            throw error;
        }
    }

    // ==================== BUSCAR PRODUTOS ====================

    /**
     * Buscar produtos para uma seção específica
     */
    async getProductsForSection(section: CatalogSection): Promise<CatalogProduct[]> {
        try {
            let query = supabase
                .from('products')
                .select('*');

            // Aplicar filtros baseados no tipo de seção
            query = this.applySectionTypeFilter(query, section.section_type);

            // Aplicar filtros customizados (para seções custom)
            if (section.filter_categories && section.filter_categories.length > 0) {
                query = query.in('category_id', section.filter_categories);
            }

            if (section.filter_brands && section.filter_brands.length > 0) {
                query = query.in('brand', section.filter_brands);
            }

            if (section.filter_min_price !== undefined) {
                query = query.gte('price_retail', section.filter_min_price);
            }

            if (section.filter_max_price !== undefined) {
                query = query.lte('price_retail', section.filter_max_price);
            }

            // Aplicar ordenação
            query = this.applySorting(query, section.sort_by, section.sort_direction);

            // Limitar quantidade
            query = query.limit(section.max_products);

            const { data, error } = await query;

            if (error) throw error;
            return (data || []) as CatalogProduct[];
        } catch (error) {
            console.error('Erro ao buscar produtos da seção:', error);
            return [];
        }
    }

    // ==================== HELPERS PRIVADOS ====================

    private applySectionTypeFilter(query: any, sectionType: SectionType) {
        switch (sectionType) {
            case 'recent':
                // Produtos mais recentes
                return query.order('created_at', { ascending: false });

            case 'featured':
                // Produtos em destaque
                return query.eq('is_featured', true);

            case 'bestsellers':
                // Mais vendidos
                return query.order('sales_count', { ascending: false });

            case 'promotions':
                // Produtos com desconto
                return query.gt('discount_percentage', 0);

            case 'new':
                // Produtos marcados como novos
                return query.eq('is_new', true);

            case 'custom':
                // Sem filtro automático, usa apenas filtros customizados
                return query;

            default:
                return query;
        }
    }

    private applySorting(query: any, sortBy: string, sortDirection: string) {
        const ascending = sortDirection === 'asc';

        switch (sortBy) {
            case 'created_at':
                return query.order('created_at', { ascending });
            case 'sales_count':
                return query.order('sales_count', { ascending });
            case 'price':
                return query.order('price_retail', { ascending });
            case 'name':
                return query.order('name', { ascending });
            case 'updated_at':
                return query.order('updated_at', { ascending });
            default:
                return query.order('created_at', { ascending: false });
        }
    }

    private clearCache() {
        this.cache.clear();
    }
}

export const catalogSectionsService = new CatalogSectionsService();
