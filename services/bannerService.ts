import { supabase } from './supabase';
import type { Banner } from '@/types/catalog';

export const bannerService = {
    /**
     * Buscar banners ativos
     */
    getActiveBanners: async (): Promise<Banner[]> => {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('catalog_banners')
            .select('*')
            .eq('is_active', true)
            .or(`start_date.is.null,start_date.lte.${now}`)
            .or(`end_date.is.null,end_date.gte.${now}`)
            .order('display_order', { ascending: true });

        if (error) throw error;

        return (data || []) as Banner[];
    },

    /**
     * Buscar todos os banners (admin)
     */
    getAllBanners: async (): Promise<Banner[]> => {
        const { data, error } = await supabase
            .from('catalog_banners')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;

        return (data || []) as Banner[];
    },

    /**
     * Buscar banner por ID
     */
    getBannerById: async (id: string): Promise<Banner | null> => {
        const { data, error } = await supabase
            .from('catalog_banners')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return data as Banner;
    },

    /**
     * Criar banner
     */
    createBanner: async (banner: Omit<Banner, 'id' | 'created_at' | 'updated_at' | 'clicks_count' | 'views_count'>): Promise<Banner> => {
        const { data, error } = await supabase
            .from('catalog_banners')
            .insert(banner)
            .select()
            .single();

        if (error) throw error;

        return data as Banner;
    },

    /**
     * Atualizar banner
     */
    updateBanner: async (id: string, updates: Partial<Banner>): Promise<Banner> => {
        const { data, error } = await supabase
            .from('catalog_banners')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return data as Banner;
    },

    /**
     * Deletar banner
     */
    deleteBanner: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('catalog_banners')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Registrar clique no banner
     */
    trackBannerClick: async (bannerId: string): Promise<void> => {
        await supabase.rpc('increment_banner_clicks', { banner_id: bannerId });
    },

    /**
     * Registrar visualização do banner
     */
    trackBannerView: async (bannerId: string): Promise<void> => {
        await supabase.rpc('increment_banner_views', { banner_id: bannerId });
    },

    /**
     * Reordenar banners
     */
    reorderBanners: async (bannerIds: string[]): Promise<void> => {
        const updates = bannerIds.map((id, index) => ({
            id,
            display_order: index
        }));

        for (const update of updates) {
            await supabase
                .from('catalog_banners')
                .update({ display_order: update.display_order })
                .eq('id', update.id);
        }
    }
};

// Funções RPC para criar no Supabase
/*
CREATE OR REPLACE FUNCTION increment_banner_clicks(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE catalog_banners 
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_banner_views(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE catalog_banners 
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
