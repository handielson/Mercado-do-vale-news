import { supabase } from './supabase';
import type { Banner } from '@/types/catalog';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerType = 'varejo' | 'revenda' | 'atacado';

export interface BannerStats {
    total: number;
    active: number;
    inactive: number;
    expired: number;
    totalClicks: number;
    totalViews: number;
    topByClicks: { id: string; title: string; clicks_count: number } | null;
    topByViews: { id: string; title: string; views_count: number } | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const bannerService = {

    /**
     * Buscar banners ativos (uso público — catálogo)
     * Filtra por is_active + datas de agendamento + tipo de cliente.
     */
    getActiveBanners: async (customerType?: CustomerType): Promise<Banner[]> => {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('catalog_banners')
            .select('*')
            .eq('is_active', true)
            .or(`start_date.is.null,start_date.lte.${now}`)
            .or(`end_date.is.null,end_date.gte.${now}`)
            .order('display_order', { ascending: true });

        if (error) throw error;

        let banners = (data || []) as Banner[];

        // Filtrar por tipo de cliente se informado
        if (customerType) {
            banners = banners.filter(b =>
                !b.target_audience ||
                b.target_audience.length === 0 ||
                b.target_audience.includes(customerType)
            );
        }

        return banners;
    },

    /**
     * Buscar todos os banners (uso admin — sem filtro de ativo/data)
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
    createBanner: async (
        banner: Omit<Banner, 'id' | 'created_at' | 'updated_at' | 'clicks_count' | 'views_count'>
    ): Promise<Banner> => {
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
     * Duplicar banner
     * Cria uma cópia inativa com "<título> (cópia)"
     */
    duplicateBanner: async (id: string): Promise<Banner> => {
        const original = await bannerService.getBannerById(id);
        if (!original) throw new Error('Banner não encontrado');

        const { id: _id, created_at, updated_at, clicks_count, views_count, ...rest } = original;

        const { data, error } = await supabase
            .from('catalog_banners')
            .insert({
                ...rest,
                title: `${rest.title} (cópia)`,
                is_active: false,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Banner;
    },

    /**
     * Estatísticas consolidadas de banners (uso admin)
     */
    getBannerStats: async (): Promise<BannerStats> => {
        const { data, error } = await supabase
            .from('catalog_banners')
            .select('id, title, clicks_count, views_count, is_active, end_date');

        if (error) throw error;

        const banners = data || [];
        const now = new Date();

        const sorted_clicks = [...banners].sort(
            (a, b) => (b.clicks_count || 0) - (a.clicks_count || 0)
        );
        const sorted_views = [...banners].sort(
            (a, b) => (b.views_count || 0) - (a.views_count || 0)
        );

        return {
            total: banners.length,
            active: banners.filter(b => b.is_active).length,
            inactive: banners.filter(b => !b.is_active).length,
            expired: banners.filter(b => b.end_date && new Date(b.end_date) < now).length,
            totalClicks: banners.reduce((s, b) => s + (b.clicks_count || 0), 0),
            totalViews: banners.reduce((s, b) => s + (b.views_count || 0), 0),
            topByClicks: sorted_clicks[0] ?? null,
            topByViews: sorted_views[0] ?? null,
        };
    },

    /**
     * Reordenar banners — Bug fix: usa Promise.all em vez de loop sequencial
     */
    reorderBanners: async (updates: Array<{ id: string; display_order: number }>): Promise<void> => {
        await Promise.all(
            updates.map(u =>
                supabase
                    .from('catalog_banners')
                    .update({ display_order: u.display_order })
                    .eq('id', u.id)
            )
        );
    },

    /**
     * Registrar clique no banner via RPC
     */
    trackBannerClick: async (bannerId: string): Promise<void> => {
        await supabase.rpc('increment_banner_clicks', { banner_id: bannerId });
    },

    /**
     * Registrar visualização do banner via RPC
     */
    trackBannerView: async (bannerId: string): Promise<void> => {
        await supabase.rpc('increment_banner_views', { banner_id: bannerId });
    },
};

// ─── RPCs necessárias no Supabase (executar uma vez) ─────────────────────────
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
