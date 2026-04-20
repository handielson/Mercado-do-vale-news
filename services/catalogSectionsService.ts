import { supabase } from './supabase';
import type { CatalogSection, CreateSectionData, UpdateSectionData, SectionType } from '@/types/catalogSections';
import type { CatalogProduct } from '@/types/catalog';
import { catalogConfigService } from '@/services/catalogConfigService';
import { normalizeProduct } from '@/services/productNormalizer';
import { buildVpsUrl } from '@/services/vpsProxyBase';

class CatalogSectionsService {
    private cache: Map<string, { data: CatalogSection[]; timestamp: number }> = new Map();
    private cacheDuration = 5 * 60 * 1000; // 5 minutos

    // Prefix for persistent LocalStorage caching of section products
    // ⚠️ Bump a versão aqui sempre que a lógica de fetch mudar (invalida cache antigo automaticamente)
    private CACHE_KEY_PREFIX = '@mv:section_products:v3:';

    // Helper to safely access localStorage (prevents SSR errors)
    private getStorage = () => typeof window !== 'undefined' ? window.localStorage : null;

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
    async getProductsForSection(section: CatalogSection, bypassCache: boolean = false): Promise<CatalogProduct[]> {
        const cacheKey = `${this.CACHE_KEY_PREFIX}${section.id}`;

        // 1. SWR: Return from LocalStorage immediately for fast paints (unless bypassed)
        if (!bypassCache) {
            const storage = this.getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < this.cacheDuration) {
                            console.log(`⚡ [catalogSectionsService] Serving section ${section.title} from persistent cache`);
                            return cached.data;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse section products cache', e);
                }
            }
        }

        try {
            console.log(`🌐 [catalogSectionsService] Fetching section ${section.title} from VPS (bypassCache: ${bypassCache})`);
            
            // Build query params for the VPS
            const params = new URLSearchParams();
            
            // Limit mapping
            const fetchLimit = Math.min((section.max_products || 12) * 10, 200);
            params.append('limit', fetchLimit.toString());

            // App settings filters
            const settings = await catalogConfigService.getSettings();
            // if (settings.hide_inactive) params.append('status', 'active'); // Removido. A validação correta fica por conta do catalogConfigService
            
            if (settings.hide_zero_price) {
                // Removido o min_price=0.01 pois a API da VPS estava bloqueando tudo 
                // por conflito entre os campos price e price_retail no banco.
                // O filtro hide_zero_price vai atuar de forma segura client-side através do applyVisibilityRules.
            }

            // Section Filters
            if (section.section_type === 'featured') params.append('is_featured', 'true');
            if (section.section_type === 'new')      params.append('is_new', 'true');
            if (section.section_type === 'promotions') params.append('has_discount', 'true');

            // NOTA: O VPS só suporta ?category= (ID único). O parâmetro in_category é ignorado.
            // O filtro por múltiplas categorias é aplicado client-side abaixo após o fetch.

            if (section.filter_brands && section.filter_brands.length > 0) {
                params.append('in_brand', section.filter_brands.join(','));
            }

            if (section.filter_min_price !== undefined && section.filter_min_price !== null && typeof section.filter_min_price === 'number') {
                params.append('min_price', section.filter_min_price.toString());
            }

            if (section.filter_max_price !== undefined && section.filter_max_price !== null && typeof section.filter_max_price === 'number') {
                params.append('max_price', section.filter_max_price.toString());
            }

            // Pinned Products (Fetch those directly if configured)
            // Wait, pinned products ignore other filters typically, but we can pass them in the query,
            // or we might need to fetch them separately.
            let products = [] as CatalogProduct[];

            // Sorting — default seguro: updated_at DESC para qualquer seção sem sort configurado
            // MOTIVO: produtos movidos para novas subcategorias têm updated_at recente mas created_at antigo
            // updated_at reflete quando o produto foi modificado/recategorizado, garantindo que
            // "Mais Recentes" mostre produtos recém-adicionados ou atualizados
            if (section.sort_by) {
                params.append('sort_by', section.sort_by);
                if (section.sort_direction) params.append('sort_direction', section.sort_direction);
            } else {
                params.append('sort_by', 'updated_at');
                params.append('sort_direction', 'desc');
            }

            // Fetch dynamic products
            const res = await fetch(buildVpsUrl(`/products?${params.toString()}`));
            if (!res.ok) throw new Error(`VPS API returned ${res.status}`);
            const data = await res.json();
            
            // Normaliza dados da VPS para campos canônicos (elimina colisões VPS ↔ Supabase)
            products = (data || []).map((p: any) => normalizeProduct(p) as unknown as CatalogProduct);

            // Filtro client-side por categorias (VPS ignora in_category, só aceita category único)
            // Expande filter_categories para incluir subcategorias do Supabase
            if (section.filter_categories && section.filter_categories.length > 0 && !section.pinned_product_ids?.length) {
                // Busca hierarquia de categorias para expandir pais → filhos
                const { data: allCats } = await supabase.from('categories').select('id, parent_id');
                const parentSet = new Set(section.filter_categories);
                const allowedCats = new Set(section.filter_categories);
                for (const cat of (allCats || [])) {
                    if (cat.parent_id && parentSet.has(cat.parent_id)) {
                        allowedCats.add(cat.id);
                    }
                }
                products = products.filter(p => p.category_id && allowedCats.has(p.category_id));
                console.log(`[catalogSectionsService] Filtro client-side por categorias (expandido): ${products.length} de ${data?.length || 0} (categorias: ${[...allowedCats].length})`);
            }

            // Replace with Pinned products if any (to preserve sorting and exact matching)
            // Note: Since VPS API `in_ids` would just filter them, if section defines pins we do an explicit lookup.
            if (section.pinned_product_ids && section.pinned_product_ids.length > 0) {
                try {
                    const pinnedParams = new URLSearchParams();
                    pinnedParams.append('limit', fetchLimit.toString());
                    pinnedParams.append('in_ids', section.pinned_product_ids.join(','));
                    
                    const pinnedRes = await fetch(buildVpsUrl(`/products?${pinnedParams.toString()}`));
                    if (pinnedRes.ok) {
                        const pinnedData = await pinnedRes.json();
                        // Preserve exact order from pinned_product_ids
                        const orderedPinned = section.pinned_product_ids
                            .map(id => pinnedData.find((p: any) => p.id === id))
                            .filter(Boolean) as CatalogProduct[];
                        
                        // Override products with pinned ones, or append depending on logic
                        // Previously it completely replaced them if any were found:
                        products = orderedPinned;
                    }
                } catch (e) {
                    console.error('Error fetching pinned products from VPS', e);
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
                    productsNeedingImages.map(p => p.specs?.color).filter(Boolean) as string[]
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
                    // Build color name → id map
                    const colorNameToId = new Map<string, string>(
                        (colorRows || []).map(c => [c.name, c.id])
                    );

                    products = products.map(product => {
                        if (product.images && product.images.length > 0) return product;
                        if (!product.model_id) return product;

                        const entriesForModel = modelImages.filter(mi => mi.model_id === product.model_id);
                        if (entriesForModel.length === 0) return product;

                        // Try to find entry matching the product's color
                        const colorName = product.specs?.color;
                        const colorId = colorName ? colorNameToId.get(colorName) : undefined;
                        let chosen = colorId
                            ? entriesForModel.find(mi => mi.color_id === colorId)
                            : undefined;

                        // Fallback: first available entry for the model
                        if (!chosen) chosen = entriesForModel[0];

                        if (chosen?.images?.length > 0) {
                            return { ...product, images: chosen.images };
                        }
                        return product;
                    });
                }
            }

            // Aplicar regras globais de visibilidade (ex: ocultar sem estoque)
            products = catalogConfigService.applyVisibilityRules(products, settings);

            // Update persistent cache
            if (!bypassCache) {
                const storage = this.getStorage();
                if (storage) {
                    try {
                        storage.setItem(cacheKey, JSON.stringify({
                            data: products,
                            timestamp: Date.now()
                        }));
                    } catch (e) {
                        // Ignore quota exceeded
                    }
                }
            }

            return products;
        } catch (error) {
            console.error('Erro ao buscar produtos da seção:', error);
            return [];
        }
    }

    // ==================== HELPERS PRIVADOS ====================

    private applySectionTypeFilter(query: any, sectionType: SectionType) {
        switch (sectionType) {
            case 'recent':
                // Produtos mais recentes (ordenação aplicada por applySorting)
                return query;

            case 'featured':
                // Produtos em destaque
                return query.eq('is_featured', true);

            case 'bestsellers':
                // Mais vendidos (ordenação aplicada por applySorting)
                return query;

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

    /**
     * Limpar todo o cache de produtos de seções (localStorage) + cache de seções (memória)
     * útil após criar/mover produtos para garantir que as seções reflitam os dados atuais.
     */
    public clearProductsCache(): void {
        const storage = this.getStorage();
        if (storage) {
            const keysToRemove = Object.keys(storage).filter(k => k.startsWith(this.CACHE_KEY_PREFIX));
            keysToRemove.forEach(k => storage.removeItem(k));
            console.log(`[catalogSectionsService] Cleared ${keysToRemove.length} section product cache entries from localStorage`);
        }
        this.cache.clear();
    }
}

export const catalogSectionsService = new CatalogSectionsService();
