import { supabase } from './supabase';
import { vpsClient } from './vpsClient';
import { USE_VPS } from '@/config/migration';
import type { Banner } from '@/types/catalog';

// ─── Adapters VPS <-> Supabase ────────────────────────────────────────────────

function mapFromVPS(vpsBanner: any): Banner {
    let link_type: Banner['link_type'] = 'none';
    if (vpsBanner.link_url) {
        if (vpsBanner.link_url.includes('http')) link_type = 'external';
        else if (vpsBanner.link_url.length === 36 && vpsBanner.link_url.includes('-')) link_type = 'product';
        else link_type = 'category';
    }

    return {
        ...vpsBanner,
        is_active: vpsBanner.active ?? false,
        link_target: vpsBanner.link_url,
        link_type,
        clicks_count: vpsBanner.clicks_count ?? 0,
        views_count: vpsBanner.views_count ?? 0,
        target_audience: vpsBanner.target_audience ?? [],
        updated_at: vpsBanner.updated_at ?? vpsBanner.created_at,
    };
}

function mapToVPS(banner: any): any {
    const payload = { ...banner };
    if ('is_active' in banner) {
        payload.active = banner.is_active;
        delete payload.is_active;
    }
    if ('link_target' in banner) {
        payload.link_url = banner.link_target || null;
        delete payload.link_target;
    }
    delete payload.link_type;
    delete payload.clicks_count;
    delete payload.views_count;
    delete payload.target_audience;
    return payload;
}

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
        const now = new Date();
        const allBanners = await bannerService.getAllBanners();

        let banners = allBanners.filter(b => {
            if (!b.is_active) return false;
            if (b.start_date && new Date(b.start_date) > now) return false;
            if (b.end_date && new Date(b.end_date) < now) return false;
            return true;
        });

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
        if (USE_VPS.banners) {
            const data = await vpsClient.get<any[]>('/banners');
            return data.map(mapFromVPS);
        }

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
        if (USE_VPS.banners) {
            const data = await vpsClient.get<any>(`/banners/${id}`);
            return data ? mapFromVPS(data) : null;
        }

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
        if (USE_VPS.banners) {
            const data = await vpsClient.post<any>('/banners', mapToVPS(banner));
            return mapFromVPS(data);
        }

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
        if (USE_VPS.banners) {
            const data = await vpsClient.patch<any>(`/banners/${id}`, mapToVPS(updates));
            return mapFromVPS(data);
        }

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
        if (USE_VPS.banners) return vpsClient.delete(`/banners/${id}`);

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

        const payload = {
            ...rest,
            title: `${rest.title} (cópia)`,
            is_active: false,
        };

        if (USE_VPS.banners) {
            const data = await vpsClient.post<any>('/banners', mapToVPS(payload));
            return mapFromVPS(data);
        }

        const { data, error } = await supabase
            .from('catalog_banners')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data as Banner;
    },

    /**
     * Estatísticas consolidadas de banners (uso admin)
     */
    getBannerStats: async (): Promise<BannerStats> => {
        // Usa a source of truth correta (VPS ou Supabase)
        const banners = await bannerService.getAllBanners();
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
        if (USE_VPS.banners) {
            await vpsClient.post(`/banners/${bannerId}/click`, {});
            return;
        }
        await supabase.rpc('increment_banner_clicks', { banner_id: bannerId });
    },

    /**
     * Registrar visualização do banner via RPC
     */
    trackBannerView: async (bannerId: string): Promise<void> => {
        if (USE_VPS.banners) {
            await vpsClient.post(`/banners/${bannerId}/view`, {});
            return;
        }
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
