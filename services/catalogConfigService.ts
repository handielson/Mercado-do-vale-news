import { supabase } from './supabase';
import { vpsApiService } from './vpsApiService';
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
            const cacheKey = userId ? `settings_${userId}` : 'settings_global';
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data;
            }

            // Tentar VPS API primeiro (apenas para leitura pública, sem userId)
            if (!userId) {
                const vpsData = await vpsApiService.getCatalogSettings();
                if (vpsData) {
                    const settings = { ...DEFAULT_CATALOG_SETTINGS, ...vpsData } as CatalogSettings;
                    this.cache.set(cacheKey, { data: settings, timestamp: Date.now() });
                    return settings;
                }
            }

            // Fallback: Supabase
            let query = supabase.from('catalog_settings').select('*');
            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query.limit(1).single();

            if (error && error.code !== 'PGRST116') {
                if (error.code === '20' || error.message?.includes('aborted') || error.message?.includes('abort')) {
                    return { ...DEFAULT_CATALOG_SETTINGS } as CatalogSettings;
                }
                console.error('Erro ao buscar catalog_settings:', error);
            }

            const settings = data || { ...DEFAULT_CATALOG_SETTINGS, user_id: userId };
            this.cache.set(cacheKey, { data: settings, timestamp: Date.now() });
            return settings as CatalogSettings;
        } catch (error: any) {
            if (error.name !== 'AbortError' && error.message !== 'AbortError' && !error.message?.includes('aborted')) {
                console.error('Erro ao buscar configurações:', error);
            }
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

            // Envia apenas colunas que existem em catalog_settings (evita erro de schema cache)
            const allowedKeys: Array<keyof CatalogSettings> = [
                'catalog_name', 'catalog_description', 'catalog_subtitle', 'welcome_message',
                'hide_out_of_stock', 'hide_zero_price', 'hide_inactive', 'min_stock_to_show',
                'hide_empty_categories', 'hide_categories_no_stock', 'show_product_count',
                'show_prices', 'show_old_price', 'show_discount_badge', 'price_format',
                'show_stock', 'show_stock_quantity', 'low_stock_threshold', 'show_low_stock_warning',
                'show_product_images', 'image_quality', 'enable_image_zoom', 'show_image_gallery',
                'products_per_page', 'enable_infinite_scroll', 'default_sort', 'enable_sort_options',
                'show_filters', 'show_category_filter', 'show_brand_filter', 'show_price_filter',
                'show_stock_filter', 'enable_search', 'search_placeholder',
                'layout_mode', 'grid_columns_mobile', 'grid_columns_tablet', 'grid_columns_desktop', 'grid_columns_wide', 'card_style',
                'theme_mode', 'primary_color', 'secondary_color', 'accent_color',
                'background_color', 'card_background', 'text_primary', 'text_secondary',
                'category_display_style', 'category_icon_size', 'show_category_icons', 'show_category_images', 'category_layout',
                'enable_favorites', 'enable_share', 'enable_whatsapp_share', 'enable_product_comparison', 'enable_quick_view', 'show_related_products',
                'show_new_badge', 'new_product_days', 'show_featured_badge', 'show_out_of_stock_badge', 'show_low_stock_badge',
                'meta_title', 'meta_description', 'meta_keywords', 'og_image', 'enable_seo_friendly_urls',
                'enable_public_catalog', 'catalog_slug', 'require_login', 'enable_qr_code',
                'track_views', 'track_clicks', 'track_shares', 'google_analytics_id',
                'notify_low_stock', 'notify_out_of_stock', 'notification_email',
                'custom_css', 'custom_header_html', 'custom_footer_html', 'enable_cache', 'cache_duration_minutes'
            ];

            const dataToSave: Record<string, unknown> = {
                user_id: user.id,
                updated_at: new Date().toISOString()
            };

            for (const key of allowedKeys) {
                const value = settings[key];
                if (value !== undefined) {
                    dataToSave[key] = value;
                }
            }

            const { error } = await supabase
                .from('catalog_settings')
                .upsert(dataToSave, { onConflict: 'user_id' });

            if (error) {
                console.error('❌ Erro:', error?.message, error?.code);
                throw error;
            }

            console.log('✅ Salvo com sucesso!');
            this.cache.delete(`settings_${user.id}`);
            this.cache.delete('settings_global');
        } catch (error: any) {
            console.error('❌ Erro ao salvar configurações:', error);
            throw new Error(error?.message || 'Erro ao salvar configurações');
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
            if (settings.hide_inactive) {
                const s = String(product.status || '').toLowerCase();
                if (s && s !== 'active' && s !== 'ativo' && s !== 'disponível' && s !== 'disponivel') {
                    return false;
                }
            }

            // Regra: Ocultar sem estoque (ignoramos a regra se o produto não rastrear estoque)
            if (settings.hide_out_of_stock && product.track_inventory !== false && (product.stock_quantity || 0) <= 0) {
                return false;
            }

            // Regra: Ocultar com preço zero
            if (settings.hide_zero_price && (!product.price_retail || product.price_retail <= 0)) {
                return false;
            }

            // Regra: Estoque mínimo (ignoramos a regra se o produto não rastrear estoque)
            if (product.track_inventory !== false && (product.stock_quantity || 0) < (settings.min_stock_to_show || 0)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Aplicar regras de visibilidade nas categorias
     */
    async applyCategoryVisibilityRules(
        categories: Array<{ id: string; name: string; parent_id?: string | null; count: number; in_stock_count?: number }>,
        settings: CatalogSettings
    ): Promise<Array<{ id: string; name: string; parent_id?: string | null; count: number; in_stock_count?: number }>> {
        // Regra: Ocultar categorias vazias
        if (settings.hide_empty_categories) {
            categories = categories.filter(cat => {
                if (cat.count > 0) return true;
                // Mantém a categoria se ela for pai de alguma subcategoria com produtos
                const hasFilledChild = categories.some(child => child.parent_id === cat.id && child.count > 0);
                if (hasFilledChild) return true;
                return false;
            });
        }

        // Regra: Ocultar categorias sem estoque
        // Produtos com stock_quantity=null não monitoram estoque (ex: acessórios) → tratados como disponíveis
        if (settings.hide_categories_no_stock) {
            categories = categories.filter(cat => {
                if ((cat.in_stock_count ?? 0) > 0) return true;
                // Mantém se for categoria pai e alguma subcategoria tiver estoque
                const hasFilledChild = categories.some(child => child.parent_id === cat.id && (child.in_stock_count ?? 0) > 0);
                if (hasFilledChild) return true;
                return false;
            });
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
