// model-version-promo-v1: grava a promoção por tempo limitado nos cadastros (products.price_promo/promo_start/promo_end).
// É o mesmo campo do formulário do produto (seção "Promoção por Tempo Limitado") e o que a campanha do Marketing lê.
// Usa o PATCH parcial do produto: só esses três campos mudam; preços do grupo e custo ficam intactos.
import { vpsClient } from './vpsClient';
import { vpsApiService } from './vpsApiService';
import { bannerService } from './bannerService';
import { promoCampaignService } from './promoCampaignService';
import { uploadService } from './uploadService';

export type PromoInput = { priceCents: number; start: string | null; end: string | null } | null;

export async function saveProductsPromo(productIds: string[], promo: PromoInput): Promise<{ saved: number; failed: Array<{ id: string; error: string }> }> {
  const body = promo
    ? { price_promo: promo.priceCents, promo_start: promo.start || null, promo_end: promo.end || null }
    : { price_promo: null, promo_start: null, promo_end: null };
  const failed: Array<{ id: string; error: string }> = [];
  let saved = 0;
  for (const id of productIds) {
    try {
      await vpsClient.patch(`/table-data/products/${encodeURIComponent(id)}`, body);
      saved += 1;
    } catch (error) {
      failed.push({ id, error: error instanceof Error ? error.message : 'erro ao salvar' });
    }
  }
  vpsApiService.invalidateProductCache();
  return { saved, failed };
}

// ── promo-media-v1: imagem, vídeo e banner da promoção, por versão ──

export type PromoMedia = { image_url: string | null; video_url: string | null; banner_id: string | null };
export const EMPTY_PROMO_MEDIA: PromoMedia = { image_url: null, video_url: null, banner_id: null };

/** Mídia da promoção de vários cadastros (a mesma em todas as cores da versão). */
export async function loadPromoMedia(productIds: string[]): Promise<Record<string, PromoMedia>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return {};
  const result: Record<string, PromoMedia> = {};
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const data = await vpsClient.get<{ items: Record<string, PromoMedia> }>(`/admin/products/promo-media?ids=${chunk.map(encodeURIComponent).join(',')}`);
    Object.assign(result, data.items || {});
  }
  return result;
}

export function savePromoMedia(productIds: string[], media: PromoMedia) {
  return vpsClient.put<{ ok: boolean; items: Record<string, PromoMedia> }>('/admin/products/promo-media', { product_ids: productIds, ...media });
}

export const uploadPromoFile = (file: File, onProgress?: (pct: number) => void) => promoCampaignService.uploadMedia(file, onProgress);

// promo-banner-derivatives-v1: o banner vai pelo mesmo upload da tela de Banners, que gera as versões
// -768/-1280 em AVIF/WEBP. Sem elas o carrossel da home (<picture>) mostrava a imagem quebrada.
export const uploadPromoBannerFile = (file: File) => uploadService.uploadBannerImage(file);

/**
 * Banner da home da promoção: é um banner normal (aparece no carrossel e na tela de Banners),
 * vinculado à página do produto e com as mesmas datas da promoção.
 */
export async function upsertPromoBanner(input: { bannerId: string | null; title: string; imageUrl: string; productUrl: string; start: string | null; end: string | null }): Promise<string> {
  const fields = {
    title: input.title,
    image_url: input.imageUrl,
    link_type: 'product' as const,
    link_target: input.productUrl,
    is_active: true,
    start_date: (input.start || undefined) as any,
    end_date: (input.end || undefined) as any,
  };
  if (input.bannerId) {
    try {
      const updated = await bannerService.updateBanner(input.bannerId, fields);
      if (updated?.id) return updated.id;
    } catch (error) {
      // Banner apagado na tela de Banners: cria outro.
      if (!/not found|404/i.test(error instanceof Error ? error.message : '')) throw error;
    }
  }
  const created = await bannerService.createBanner({ ...fields, storefront: 'mercado_do_vale', display_order: 0, target_audience: [] } as any);
  return created.id;
}

/** Acompanha a promoção: novas datas, ou desliga o banner quando a promoção sai. */
export async function syncPromoBanner(bannerId: string | null, promo: PromoInput) {
  if (!bannerId) return;
  try {
    if (promo) await bannerService.updateBanner(bannerId, { is_active: true, start_date: (promo.start || null) as any, end_date: (promo.end || null) as any });
    else await bannerService.updateBanner(bannerId, { is_active: false });
  } catch (error) {
    if (!/not found|404/i.test(error instanceof Error ? error.message : '')) throw error;
  }
}

export async function removePromoBanner(bannerId: string | null) {
  if (!bannerId) return;
  try { await bannerService.deleteBanner(bannerId); }
  catch (error) { if (!/not found|404/i.test(error instanceof Error ? error.message : '')) throw error; }
}
