import { vpsClient } from './vpsClient';
import { buildAuthHeaders, getAuthSessionToken } from './authSession';
import { buildVpsUrl, getVpsSyncHeaders } from './vpsProxyBase';
import { pollSynologyUploadStatus, uploadVideoWithProgress } from './productVideoUpload';
import type { PhonePriceListPreview } from './socialStoryScheduleService';

export type PromoCampaignMediaType = 'image' | 'video';

export interface PromoCampaign {
  headline: string;
  footer: string;
  media_url: string | null;
  media_type: PromoCampaignMediaType | null;
  updated_at?: string | null;
}

export interface PromoCampaignProduct {
  id: string;
  sku: string | null;
  name: string;
  retailCents: number;
  promoCents: number;
  promoStart: string | null;
  promoEnd: string | null;
  stock: number | null;
  /** promo-media-v1: imagem e vídeo próprios da promoção (Página do Produto → versão). */
  promoImageUrl?: string | null;
  promoVideoUrl?: string | null;
}

/** product-promotions-list-v1: promoção de preço de uma versão (Central de Promoções). */
export interface ProductPromotionSummary {
  id: string;
  modelId: string | null;
  modelName: string;
  version: string;
  productIds: string[];
  firstProductId: string;
  colors: string[];
  retailCents: number;
  promoCents: number;
  discountPct: number;
  start: string | null;
  end: string | null;
  status: 'active' | 'scheduled';
  stock: number;
  media: { image: boolean; video: boolean; banner: boolean };
}

/** Atalho de edição: a promoção da versão é editada na Página do Produto (rola até a versão). */
export const productPromotionEditPath = (promo: Pick<ProductPromotionSummary, 'modelId' | 'firstProductId'>) => promo.modelId
  ? `/admin/products/models/${promo.modelId}#promo-${promo.firstProductId}`
  : `/admin/products/${promo.firstProductId}`;

export interface PromoCampaignOverview {
  ok: true;
  campaign: PromoCampaign;
  products: PromoCampaignProduct[];
  whatsapp: { text: string; length: number; fitsMediaCaption: boolean };
  generatedAt: string;
}

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' };

async function uploadImage(file: File): Promise<string> {
  const extension = IMAGE_TYPES[file.type];
  if (!extension) throw new Error('Envie uma imagem PNG, JPG, WEBP ou GIF.');
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 15 MB.');
  const name = `${crypto.randomUUID()}.${extension}`;
  const form = new FormData();
  form.append('file', file, name);
  form.append('path', `banners/promo-campaign/${name}`);
  const response = await fetch(buildVpsUrl('/images/upload', { method: 'POST' }), {
    method: 'POST',
    headers: await buildAuthHeaders({ ...getVpsSyncHeaders() }),
    body: form,
  });
  const result = await response.json().catch(() => null) as { url?: string; error?: string } | null;
  if (!response.ok || !result?.url) throw new Error(result?.error || 'Não foi possível enviar a imagem.');
  return result.url;
}

async function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!/\.mp4$/i.test(file.name) || (file.type && file.type !== 'video/mp4')) throw new Error('Envie o vídeo em MP4.');
  if (file.size > 500 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 500 MB.');
  const token = await getAuthSessionToken();
  const form = new FormData();
  form.append('file', file, `promo-campaign-${Date.now()}.mp4`);
  const accepted = await uploadVideoWithProgress(form, token, (pct) => onProgress?.(pct));
  if (!accepted.ok || !accepted.uploadId) throw new Error('A VPS não confirmou o envio do vídeo.');
  const status = await pollSynologyUploadStatus(accepted.uploadId, token);
  if (!status.url) throw new Error('O Synology não confirmou o endereço do vídeo.');
  onProgress?.(100);
  return status.url;
}

export const promoCampaignService = {
  get: () => vpsClient.get<PromoCampaignOverview>('/admin/marketing/promo-campaign'),
  listProductPromotions: () => vpsClient.get<{ ok: true; promotions: ProductPromotionSummary[]; generatedAt: string }>('/admin/marketing/product-promotions'),
  save: (campaign: PromoCampaign) => vpsClient.put<PromoCampaignOverview>('/admin/marketing/promo-campaign', {
    headline: campaign.headline, footer: campaign.footer, media_url: campaign.media_url, media_type: campaign.media_type,
  }),
  previewStories: () => vpsClient.post<PhonePriceListPreview>('/admin/marketing/promo-campaign/stories/preview', {}, { timeoutMs: 120000 }),
  async uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; type: PromoCampaignMediaType }> {
    if (file.type.startsWith('video/') || /\.mp4$/i.test(file.name)) return { url: await uploadVideo(file, onProgress), type: 'video' };
    return { url: await uploadImage(file), type: 'image' };
  },
};
