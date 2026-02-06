import { supabase } from './supabase';
import type { CatalogBanner } from '@/types/catalog';

export interface CatalogSettings {
    id: string;
    layout_config: {
        banners_per_page: number;
        products_per_row: number;
        show_filters: boolean;
        carousel_autoplay: boolean;
        carousel_interval: number;
    };
    is_draft: boolean;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CatalogEditorState {
    banners: CatalogBanner[];
    settings: CatalogSettings | null;
}

/**
 * Serviço para gerenciar o editor de catálogo com sistema de drafts
 */
export const catalogEditorService = {
    /**
     * Carregar estado atual do catálogo (draft ou published)
     */
    async loadCatalogState(mode: 'draft' | 'published' = 'draft'): Promise<CatalogEditorState> {
        try {
            // Carregar banners
            const { data: banners, error: bannersError } = await supabase
                .from('catalog_banners')
                .select('*')
                .eq('is_draft', mode === 'draft')
                .order('display_order', { ascending: true });

            if (bannersError) throw bannersError;

            // Carregar configurações
            const { data: settings, error: settingsError } = await supabase
                .from('catalog_settings')
                .select('*')
                .eq('is_draft', mode === 'draft')
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                // PGRST116 = no rows returned, é ok se não houver settings
                throw settingsError;
            }

            return {
                banners: banners || [],
                settings: settings || null
            };
        } catch (error) {
            console.error('Erro ao carregar estado do catálogo:', error);
            throw error;
        }
    },

    /**
     * Salvar rascunho do catálogo
     */
    async saveDraft(state: CatalogEditorState): Promise<void> {
        try {
            // 1. Salvar banners como draft
            if (state.banners && state.banners.length > 0) {
                // Primeiro, deletar drafts antigos
                await supabase
                    .from('catalog_banners')
                    .delete()
                    .eq('is_draft', true);

                // Inserir novos drafts
                const bannersToInsert = state.banners.map(banner => ({
                    ...banner,
                    is_draft: true,
                    published_at: null
                }));

                const { error: bannersError } = await supabase
                    .from('catalog_banners')
                    .insert(bannersToInsert);

                if (bannersError) throw bannersError;
            }

            // 2. Salvar configurações como draft
            if (state.settings) {
                // Deletar draft antigo de settings
                await supabase
                    .from('catalog_settings')
                    .delete()
                    .eq('is_draft', true);

                // Inserir novo draft
                const { error: settingsError } = await supabase
                    .from('catalog_settings')
                    .insert({
                        layout_config: state.settings.layout_config,
                        is_draft: true,
                        published_at: null
                    });

                if (settingsError) throw settingsError;
            }
        } catch (error) {
            console.error('Erro ao salvar rascunho:', error);
            throw error;
        }
    },

    /**
     * Publicar rascunho atual
     */
    async publish(): Promise<void> {
        try {
            const now = new Date().toISOString();

            // 1. Desativar banners publicados antigos
            await supabase
                .from('catalog_banners')
                .update({ is_active: false })
                .eq('is_draft', false);

            // 2. Publicar banners draft
            const { data: draftBanners } = await supabase
                .from('catalog_banners')
                .select('*')
                .eq('is_draft', true);

            if (draftBanners && draftBanners.length > 0) {
                // Deletar drafts
                await supabase
                    .from('catalog_banners')
                    .delete()
                    .eq('is_draft', true);

                // Inserir como publicados
                const bannersToPublish = draftBanners.map(banner => ({
                    ...banner,
                    id: undefined, // Gerar novo ID
                    is_draft: false,
                    is_active: true,
                    published_at: now
                }));

                await supabase
                    .from('catalog_banners')
                    .insert(bannersToPublish);
            }

            // 3. Publicar configurações
            const { data: draftSettings } = await supabase
                .from('catalog_settings')
                .select('*')
                .eq('is_draft', true)
                .single();

            if (draftSettings) {
                // Deletar settings publicadas antigas
                await supabase
                    .from('catalog_settings')
                    .delete()
                    .eq('is_draft', false);

                // Deletar draft
                await supabase
                    .from('catalog_settings')
                    .delete()
                    .eq('is_draft', true);

                // Inserir como publicado
                await supabase
                    .from('catalog_settings')
                    .insert({
                        layout_config: draftSettings.layout_config,
                        is_draft: false,
                        published_at: now
                    });
            }
        } catch (error) {
            console.error('Erro ao publicar catálogo:', error);
            throw error;
        }
    },

    /**
     * Descartar rascunho atual
     */
    async discardDraft(): Promise<void> {
        try {
            // Deletar todos os drafts
            await supabase
                .from('catalog_banners')
                .delete()
                .eq('is_draft', true);

            await supabase
                .from('catalog_settings')
                .delete()
                .eq('is_draft', true);
        } catch (error) {
            console.error('Erro ao descartar rascunho:', error);
            throw error;
        }
    },

    /**
     * Copiar versão publicada para draft (para começar a editar)
     */
    async copyPublishedToDraft(): Promise<void> {
        try {
            // 1. Copiar banners publicados para draft
            const { data: publishedBanners } = await supabase
                .from('catalog_banners')
                .select('*')
                .eq('is_draft', false)
                .eq('is_active', true);

            if (publishedBanners && publishedBanners.length > 0) {
                // Deletar drafts existentes
                await supabase
                    .from('catalog_banners')
                    .delete()
                    .eq('is_draft', true);

                // Copiar como draft
                const draftBanners = publishedBanners.map(banner => ({
                    ...banner,
                    id: undefined, // Gerar novo ID
                    is_draft: true,
                    published_at: null
                }));

                await supabase
                    .from('catalog_banners')
                    .insert(draftBanners);
            }

            // 2. Copiar configurações publicadas para draft
            const { data: publishedSettings } = await supabase
                .from('catalog_settings')
                .select('*')
                .eq('is_draft', false)
                .single();

            if (publishedSettings) {
                // Deletar draft existente
                await supabase
                    .from('catalog_settings')
                    .delete()
                    .eq('is_draft', true);

                // Copiar como draft
                await supabase
                    .from('catalog_settings')
                    .insert({
                        layout_config: publishedSettings.layout_config,
                        is_draft: true,
                        published_at: null
                    });
            }
        } catch (error) {
            console.error('Erro ao copiar publicado para draft:', error);
            throw error;
        }
    }
};
