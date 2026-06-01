import { SECTION_PRESETS, type CatalogSection, type CreateSectionData, type UpdateSectionData, type SectionType } from '@/types/catalogSections';
import type { CatalogProduct } from '@/types/catalog';
import { catalogConfigService } from '@/services/catalogConfigService';
import { normalizeProduct } from '@/services/productNormalizer';
import { buildVpsUrl } from '@/services/vpsProxyBase';
import { vpsApiService } from '@/services/vpsApiService';
import { vpsClient } from '@/services/vpsClient';
import { colorService } from '@/services/colors';
import { modelColorImagesService } from '@/services/model-color-images';

const PUBLIC_STOREFRONT_TIMEOUT_MS = 3500;

interface TableDataResponse<T> {
    rows?: T[];
}

function sortSections(sections: CatalogSection[]): CatalogSection[] {
    return [...sections].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function parseArrayField(value: unknown): string[] | undefined {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string' || !value.trim()) return undefined;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
}

function normalizeSection(row: any): CatalogSection {
    return {
        ...row,
        is_enabled: Boolean(row.is_enabled),
        show_view_all: Boolean(row.show_view_all),
        display_order: Number(row.display_order || 0),
        max_products: Number(row.max_products || 8),
        filter_categories: parseArrayField(row.filter_categories),
        filter_brands: parseArrayField(row.filter_brands),
        filter_tags: parseArrayField(row.filter_tags),
        pinned_product_ids: parseArrayField(row.pinned_product_ids),
        filter_min_price: row.filter_min_price == null ? undefined : Number(row.filter_min_price),
        filter_max_price: row.filter_max_price == null ? undefined : Number(row.filter_max_price),
    } as CatalogSection;
}

function buildDefaultPublicSections(): CatalogSection[] {
    const now = new Date(0).toISOString();
    const defaults: Array<{
        id: string;
        section_type: SectionType;
        display_order: number;
        view_all_url: string;
    }> = [
        { id: 'public-default-recent', section_type: 'recent', display_order: 0, view_all_url: '/produtos/mais-recentes' },
        { id: 'public-default-featured', section_type: 'featured', display_order: 1, view_all_url: '/produtos/destaques' },
        { id: 'public-default-bestsellers', section_type: 'bestsellers', display_order: 2, view_all_url: '/produtos/mais-vendidos' },
    ];

    return defaults.map(item => {
        const preset = SECTION_PRESETS[item.section_type];
        return normalizeSection({
            id: item.id,
            user_id: 'system',
            section_type: item.section_type,
            title: preset.title,
            subtitle: preset.subtitle,
            is_enabled: true,
            display_order: item.display_order,
            max_products: preset.max_products || 8,
            layout_style: preset.layout_style || 'grid',
            show_view_all: true,
            view_all_url: item.view_all_url,
            sort_by: preset.sort_by || 'updated_at',
            sort_direction: preset.sort_direction || 'desc',
            created_at: now,
            updated_at: now,
        });
    });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
}

async function loadSectionRows(userId?: string): Promise<CatalogSection[]> {
    const allRows: CatalogSection[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<any>>(
            `/table-data/catalog_sections?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows.map(normalizeSection));
        if (rows.length < pageSize) break;
    }

    const filtered = userId ? allRows.filter(section => String(section.user_id) === String(userId)) : allRows;
    return sortSections(filtered);
}

class CatalogSectionsService {
    private cache: Map<string, { data: CatalogSection[]; timestamp: number }> = new Map();
    private cacheDuration = 5 * 60 * 1000; // 5 minutos

    // Prefix for persistent LocalStorage caching of section products
    // ⚠️ Bump a versão aqui sempre que a lógica de fetch mudar (invalida cache antigo automaticamente)
    private CACHE_KEY_PREFIX = '@mv:section_products:v4:';

    // Helper to safely access localStorage (prevents SSR errors)
    private getStorage = () => typeof window !== 'undefined' ? window.localStorage : null;

    private getAbortSignal = () => typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(PUBLIC_STOREFRONT_TIMEOUT_MS)
        : undefined;

    private readCachedProducts(cacheKey: string): CatalogProduct[] | null {
        const storage = this.getStorage();
        if (!storage) return null;

        try {
            const cachedStr = storage.getItem(cacheKey);
            if (!cachedStr) return null;
            const cached = JSON.parse(cachedStr);
            return Array.isArray(cached?.data) ? cached.data : null;
        } catch {
            return null;
        }
    }

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

            const sections = await loadSectionRows(userId);
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
        if (!userId) {
            return buildDefaultPublicSections();
        }

        const sections = await this.getSections(userId);
        const activeSections = sections.filter(s => s.is_enabled);
        return activeSections;
    }

    /**
     * Buscar uma seção específica
     */
    async getSection(id: string): Promise<CatalogSection> {
        try {
            const sections = await loadSectionRows();
            const section = sections.find(row => String(row.id) === String(id));
            if (!section) throw new Error('Secao nao encontrada');
            return section;
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
            const data = await vpsClient.post<any>(
                '/table-data/catalog_sections',
                stripUndefined(sectionData as unknown as Record<string, unknown>)
            );

            this.clearCache();
            return normalizeSection(data);
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
            const { id: _id, ...payload } = updates;
            const data = await vpsClient.patch<any>(
                `/table-data/catalog_sections/${encodeURIComponent(id)}?pk=id`,
                stripUndefined(payload as Record<string, unknown>)
            );

            this.clearCache();
            return normalizeSection(data);
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
            await vpsClient.delete(`/table-data/catalog_sections/${encodeURIComponent(id)}?pk=id`);
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
            await Promise.all(sectionIds.map((id, index) =>
                vpsClient.patch(
                    `/table-data/catalog_sections/${encodeURIComponent(id)}?pk=id`,
                    { display_order: index }
                )
            ));
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
            
            // Busca mais fundo porque as regras globais de visibilidade
            // (estoque/preco/status) sao aplicadas client-side apos a VPS.
            // O componente da secao ainda limita a exibicao em max_products.
            const sectionType = section.section_type;
            const fetchMultiplier = ['recent', 'new', 'bestsellers'].includes(sectionType) ? 4 : 20;
            const fetchCap = ['recent', 'new', 'bestsellers'].includes(sectionType) ? 80 : 200;
            const fetchLimit = Math.min((section.max_products || 12) * fetchMultiplier, fetchCap);
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
            const res = await fetch(buildVpsUrl(`/products?${params.toString()}`), {
                signal: this.getAbortSignal(),
            });
            if (!res.ok) throw new Error(`VPS API returned ${res.status}`);
            const data = await res.json();
            
            // Normaliza dados da VPS para campos canônicos (elimina colisões VPS ↔ VPS)
            products = (data || []).map((p: any) => normalizeProduct(p) as unknown as CatalogProduct);

            // Filtro client-side por categorias (VPS ignora in_category, só aceita category único)
            // Expande filter_categories para incluir subcategorias da VPS
            if (section.filter_categories && section.filter_categories.length > 0 && !section.pinned_product_ids?.length) {
                const allCats = await vpsApiService.getCategories();
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
                    
                    const pinnedRes = await fetch(buildVpsUrl(`/products?${pinnedParams.toString()}`), {
                        signal: this.getAbortSignal(),
                    });
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

                const [modelImages, colorRows] = await Promise.all([
                    modelColorImagesService.getByModelIds(modelIds),
                    colorNames.length > 0
                        ? colorService.list().then(colors => colors.filter(color => colorNames.includes(color.name)))
                        : Promise.resolve([])
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
            return this.readCachedProducts(cacheKey) || [];
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
