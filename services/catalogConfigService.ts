import { supabase } from './supabase';
import type { CatalogSettings, CategoryDisplayConfig } from '@/types/catalogSettings';
import { DEFAULT_CATALOG_SETTINGS } from '@/types/catalogSettings';

class CatalogConfigService {
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

    /**
     * Buscar configurações do catálogo do usuário
     */
    async getSettings(userId?: string): Promise<CatalogSettings> {
        try {
            // Tenta obter o usuário logado se não foi passado
            if (!userId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    userId = user.id;
                }
            }

            // Verificar cache global independente de cookie
            const cacheKey = userId ? `settings_${userId}` : 'settings_global';
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data;
            }

            let query = supabase.from('catalog_settings').select('*');
            if (userId) {
                query = query.eq('user_id', userId);
            }
            
            // Para visitantes públicos, pega a primeira (e única) config global do catálogo
            const { data, error } = await query.limit(1).single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Erro ao buscar catalog_settings:', error);
            }

            // Se não existir na base, retornar padrões
            const settings = data || { ...DEFAULT_CATALOG_SETTINGS, user_id: userId };

            // Atualizar cache
            this.cache.set(cacheKey, { data: settings, timestamp: Date.now() });

            return settings as CatalogSettings;
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return { ...DEFAULT_CATALOG_SETTINGS } as CatalogSettings;
        }
    }

    /**
     * Salvar configurações do catálogo
     */
    async saveSettings(settings: Partial<CatalogSettings>): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { error } = await supabase
                .from('catalog_settings')
                .upsert({
                    ...settings,
                    user_id: user.id,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            // Limpar cache
            this.cache.delete(`settings_${user.id}`);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            throw error;
        }
    }

    /**
     * Buscar configuração de exibição de uma categoria
     */
    async getCategoryConfig(categoryId: string): Promise<CategoryDisplayConfig | null> {
        try {
            const { data, error } = await supabase
                .from('category_display_config')
                .select('*')
                .eq('category_id', categoryId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Erro ao buscar configuração de categoria:', error);
            return null;
        }
    }

    /**
     * Buscar todas as configurações de categorias
     */
    async getAllCategoryConfigs(): Promise<CategoryDisplayConfig[]> {
        try {
            const { data, error } = await supabase
                .from('category_display_config')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Erro ao buscar configurações de categorias:', error);
            return [];
        }
    }

    /**
     * Salvar configuração de exibição de categoria
     */
    async saveCategoryConfig(config: Partial<CategoryDisplayConfig>): Promise<void> {
        try {
            const { error } = await supabase
                .from('category_display_config')
                .upsert({
                    ...config,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'category_id'
                });

            if (error) throw error;
        } catch (error) {
            console.error('Erro ao salvar configuração de categoria:', error);
            throw error;
        }
    }

    /**
     * Aplicar regras de visibilidade nos produtos
     */
    applyVisibilityRules(products: any[], settings: CatalogSettings): any[] {
        return products.filter(product => {
            // Regra: Ocultar inativos
            // Nota: O status no banco é "active", não "DISPONÍVEL"
            if (settings.hide_inactive && product.status !== 'active') {
                return false;
            }

            // Regra: Ocultar sem estoque
            if (settings.hide_out_of_stock && (product.stock_quantity || 0) <= 0) {
                return false;
            }

            // Regra: Ocultar com preço zero
            if (settings.hide_zero_price && (!product.price_retail || product.price_retail <= 0)) {
                return false;
            }

            // Regra: Estoque mínimo
            if ((product.stock_quantity || 0) < (settings.min_stock_to_show || 0)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Aplicar regras de visibilidade nas categorias
     */
    async applyCategoryVisibilityRules(
        categories: Array<{ id: string; name: string; count: number }>,
        settings: CatalogSettings
    ): Promise<Array<{ id: string; name: string; count: number }>> {
        // Regra: Ocultar categorias vazias
        if (settings.hide_empty_categories) {
            categories = categories.filter(cat => cat.count > 0);
        }

        // Regra: Ocultar categorias sem estoque
        // Produtos com stock_quantity=null não monitoram estoque (ex: acessórios) → tratados como disponíveis
        if (settings.hide_categories_no_stock) {
            const categoriesWithStock = await Promise.all(
                categories.map(async (cat) => {
                    const { data } = await supabase
                        .from('products')
                        .select('id')
                        .eq('category_id', cat.id)
                        .or('stock_quantity.gt.0,stock_quantity.is.null')
                        .limit(1);

                    return data && data.length > 0 ? cat : null;
                })
            );

            categories = categoriesWithStock.filter(cat => cat !== null) as typeof categories;
        }

        return categories;
    }

    /**
     * Limpar cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}

export const catalogConfigService = new CatalogConfigService();
