import { vpsClient } from './vpsClient';
import { vpsApiService } from './vpsApiService';
import type { Banner } from '@/types/catalog';
import { toBrowserSafeMediaUrl } from '@/utils/media-url';

// ─── Adapters VPS <-> VPS ────────────────────────────────────────────────

function inferBannerLinkType(linkUrl: unknown): Banner['link_type'] {
    const value = String(linkUrl || '').trim();
    if (!value) return 'none';
    if (/\/produto\//i.test(value)) return 'product';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'product';
    if (/^https?:\/\//i.test(value)) return 'external';
    return 'category';
}

function mapFromVPS(vpsBanner: any): Banner {
    const link_type = inferBannerLinkType(vpsBanner.link_url);

    return {
        ...vpsBanner,
        image_url: toBrowserSafeMediaUrl(vpsBanner.image_url),
        background_color: vpsBanner.background_color || '#020617',
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
        const linkTarget = String(banner.link_target || '').trim();
        payload.link_url = banner.link_type === 'product' && linkTarget && !/^https?:\/\//i.test(linkTarget) && !/^\/produto\//i.test(linkTarget)
            ? `/produto/${linkTarget}`
            : linkTarget || null;
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

const ACTIVE_BANNERS_CACHE_TTL_MS = 30_000;
const activeBannersCache = new Map<string, {
    expiresAt: number;
    promise?: Promise<Banner[]>;
    data?: Banner[];
}>();

function getActiveBannersCacheKey(customerType?: CustomerType) {
    return customerType ?? 'public';
}

function filterActiveBanners(allBanners: Banner[], customerType?: CustomerType) {
    const now = new Date();

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
}

const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLinkedProductIdentifier(banner: Banner): string | null {
    if (banner.link_type !== 'product') return null;
    const raw = String(banner.link_target || banner.link_url || '').trim();
    const identifier = /\/produto\//i.test(raw)
        ? raw.split(/\/produto\//i)[1]?.split(/[?#]/)[0]?.replace(/^\/+|\/+$/g, '')
        : raw;
    if (!identifier) return null;
    try {
        return decodeURIComponent(identifier);
    } catch {
        return identifier;
    }
}

function hasSellableStock(product: any): boolean {
    if (!product) return false;
    if (String(product.status || 'active').toLowerCase() !== 'active') return false;
    return product.track_inventory === false ||
        product.track_inventory === 0 ||
        product.track_inventory === '0' ||
        Number(product.stock_quantity ?? 0) > 0;
}

async function hasAvailableLinkedProduct(banner: Banner): Promise<boolean> {
    const productIdentifier = getLinkedProductIdentifier(banner);
    if (!productIdentifier) return true;

    const product = PRODUCT_ID_PATTERN.test(productIdentifier)
        ? await vpsApiService.getProductById(productIdentifier, true)
        : await vpsApiService.getProductBySlug(productIdentifier);
    if (!product) return false;
    if (hasSellableStock(product)) return true;

    const parentId = product.parent_id || (product.is_parent ? product.id : null);
    if (parentId) {
        const parentVariations = await vpsApiService.getProducts({ parent_id: String(parentId), status: 'active', limit: 500, noCache: true });
        if ((parentVariations || []).some(hasSellableStock)) return true;
    }

    if (product.model_id) {
        const modelVariations = await vpsApiService.getProducts({ model_id: product.model_id, status: 'active', limit: 500, noCache: true });
        if ((modelVariations || []).some(hasSellableStock)) return true;
    }

    return false;
}

async function filterBannersByLinkedProductAvailability(banners: Banner[]): Promise<Banner[]> {
    const checks = await Promise.all(banners.map(async banner => {
        try {
            return {
                banner,
                visible: await hasAvailableLinkedProduct(banner),
            };
        } catch (error) {
            console.warn('[bannerService] Falha ao checar estoque do produto vinculado ao banner:', error);
            return { banner, visible: true };
        }
    }));

    return checks.filter(check => check.visible).map(check => check.banner);
}

export const bannerService = {

    /**
     * Buscar banners ativos (uso público — catálogo)
     * Filtra por is_active + datas de agendamento + tipo de cliente.
     */
    getActiveBanners: async (customerType?: CustomerType): Promise<Banner[]> => {
        const cacheKey = getActiveBannersCacheKey(customerType);
        const cached = activeBannersCache.get(cacheKey);

        if (cached && cached.expiresAt > Date.now()) {
            if (cached.data) return cached.data;
            if (cached.promise) return cached.promise;
        }

        const promise = bannerService.getAllBanners()
            .then(async allBanners => {
                const banners = filterActiveBanners(allBanners, customerType);
                const availableBanners = await filterBannersByLinkedProductAvailability(banners);
                activeBannersCache.set(cacheKey, {
                    data: availableBanners,
                    expiresAt: Date.now() + ACTIVE_BANNERS_CACHE_TTL_MS,
                });
                return availableBanners;
            })
            .catch(error => {
                if (activeBannersCache.get(cacheKey)?.promise === promise) {
                    activeBannersCache.delete(cacheKey);
                }
                throw error;
            });

        activeBannersCache.set(cacheKey, {
            promise,
            expiresAt: Date.now() + ACTIVE_BANNERS_CACHE_TTL_MS,
        });

        return promise;
    },

    warmActiveBanners: (customerType?: CustomerType): void => {
        bannerService.getActiveBanners(customerType).catch(() => {});
    },

    /**
     * Buscar todos os banners (uso admin — sem filtro de ativo/data)
     */
    getAllBanners: async (): Promise<Banner[]> => {
        const data = await vpsClient.get<any[]>('/banners');
        return data.map(mapFromVPS);
    },

    /**
     * Buscar banner por ID
     */
    getBannerById: async (id: string): Promise<Banner | null> => {
        const data = await vpsClient.get<any>(`/banners/${id}`);
        return data ? mapFromVPS(data) : null;
    },

    /**
     * Criar banner
     */
    createBanner: async (
        banner: Omit<Banner, 'id' | 'created_at' | 'updated_at' | 'clicks_count' | 'views_count'>
    ): Promise<Banner> => {
        const data = await vpsClient.post<any>('/banners', mapToVPS(banner));
        return mapFromVPS(data);
    },

    /**
     * Atualizar banner
     */
    updateBanner: async (id: string, updates: Partial<Banner>): Promise<Banner> => {
        const data = await vpsClient.patch<any>(`/banners/${id}`, mapToVPS(updates));
        return mapFromVPS(data);
    },

    /**
     * Deletar banner
     */
    deleteBanner: async (id: string): Promise<void> => {
        return vpsClient.delete(`/banners/${id}`);
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

        const data = await vpsClient.post<any>('/banners', mapToVPS(payload));
        return mapFromVPS(data);
    },

    /**
     * Estatísticas consolidadas de banners (uso admin)
     */
    getBannerStats: async (): Promise<BannerStats> => {
        // Usa a source of truth correta (VPS ou VPS)
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
     * Reordenar banners pela VPS.
     */
    reorderBanners: async (updates: Array<{ id: string; display_order: number }>): Promise<void> => {
        await Promise.all(
            updates.map(u => vpsClient.patch(`/banners/${u.id}`, { display_order: u.display_order }))
        );
    },

    /**
     * Registrar clique no banner na VPS.
     */
    trackBannerClick: async (bannerId: string): Promise<void> => {
        await vpsClient.post(`/banners/${bannerId}/click`, {});
    },

    /**
     * Registrar visualizacao do banner na VPS.
     */
    trackBannerView: async (bannerId: string): Promise<void> => {
        await vpsClient.post(`/banners/${bannerId}/view`, {});
    },
};

