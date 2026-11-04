// channel-profit-v1: leitura/edição do preço de venda por canal e tabela de taxas.
import { vpsClient } from './vpsClient';
import { shopeeProductService, getShopeeStoreCode } from './shopeeProducts';
import { withShopeeConnection, normalizeShopeeConnectionId } from './shopeeConnections';
import { mercadoLivreService } from './mercadoLivreService';
import { tiktokShopService } from './tiktokShopService';
import { vpsApiService } from './vpsApiService';
import { CHANNELS, normalizeChannelFee } from '../utils/channelProfit.js';

export type ChannelId = 'site' | 'shopee_m' | 'shopee_g' | 'mercado_livre' | 'tiktok';
export type ChannelFee = ReturnType<typeof normalizeChannelFee>;
export type ChannelFeeMap = Record<ChannelId, ChannelFee & { saved: boolean }>;

export async function loadChannelFees(): Promise<ChannelFeeMap> {
  let saved: Array<{ channel: string; config: any }> = [];
  try {
    saved = (await vpsClient.get<{ settings: Array<{ channel: string; config: any }> }>('/channel-fee-settings')).settings || [];
  } catch (error) {
    console.warn('[channelPricing] taxas indisponíveis, usando padrão', error);
  }
  return Object.fromEntries(CHANNELS.map(({ id }) => {
    const row = saved.find(item => item.channel === id);
    return [id, { ...normalizeChannelFee(id, row?.config), saved: Boolean(row) }];
  })) as ChannelFeeMap;
}

export async function saveChannelFee(channel: ChannelId, config: ChannelFee) {
  return vpsClient.put(`/channel-fee-settings/${channel}`, { config: normalizeChannelFee(channel, config) });
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  return data;
}

const toCents = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
};

export type ChannelListing = {
  key: string;
  channel: ChannelId;
  label: string;
  reference: string;
  priceCents: number | null;
  error?: string;
  editable: boolean;
  // dados internos para gravar o preço
  meta: Record<string, any>;
};

async function readShopeeListing(row: any): Promise<ChannelListing> {
  const connectionId = normalizeShopeeConnectionId(row.connection_id);
  const code = getShopeeStoreCode(connectionId);
  const itemId = Number(row.shopee_item_id);
  const modelId = Number(row.shopee_model_id) > 0 ? Number(row.shopee_model_id) : null;
  const base: ChannelListing = {
    key: `shopee-${code}-${itemId}-${modelId || 0}`, channel: code === 'G' ? 'shopee_g' : 'shopee_m', label: `Shopee ${code}`,
    reference: `item ${itemId}${modelId ? ` · modelo ${modelId}` : ''}`, priceCents: null, editable: true,
    meta: { connectionId, itemId, modelId },
  };
  try {
    const info = await fetchJson(withShopeeConnection(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${itemId}`, connectionId));
    const item = info?.response?.item_list?.[0];
    if (!item) throw new Error('Anúncio não encontrado na Shopee.');
    const hasModel = item.has_model === true || item.has_model === 1 || item.has_model === '1';
    if (!hasModel) {
      base.priceCents = toCents(item.price_info?.[0]?.original_price ?? item.price_info?.[0]?.current_price);
      return base;
    }
    const list = await fetchJson(withShopeeConnection(`/api/shopee-catalog?action=get_model_list&item_id=${itemId}`, connectionId));
    const models = (list?.response?.model || []).map((model: any) => ({ modelId: Number(model.model_id), priceCents: toCents(model.price_info?.[0]?.original_price) }));
    base.meta.models = models;
    const target = modelId ? models.find((model: any) => model.modelId === modelId) : null;
    if (target) base.priceCents = target.priceCents;
    else {
      base.editable = false;
      base.error = 'Anúncio com variações, mas o vínculo não indica qual opção é este SKU. Edite pela Shopee.';
    }
  } catch (error) {
    base.error = error instanceof Error ? error.message : 'Não foi possível consultar a Shopee.';
  }
  return base;
}

export async function loadSkuListings(productId: string, fallbackProduct: any): Promise<ChannelListing[]> {
  const product = await vpsApiService.getProductById(productId, true).catch(() => null) || fallbackProduct;
  const listings: ChannelListing[] = [{
    key: 'site', channel: 'site', label: 'Site / Loja', reference: 'preço de varejo do cadastro',
    priceCents: Number(product?.price_retail) > 0 ? Number(product.price_retail) : null, editable: true, meta: { productId },
  }];
  const [shopeeRows, mlLinks, tiktok] = await Promise.allSettled([
    shopeeProductService.getByProductIds([productId]),
    mercadoLivreService.getProductLinks(),
    tiktokShopService.getProductStatus(productId),
  ]);
  if (shopeeRows.status === 'fulfilled') {
    const rows = (shopeeRows.value as any[]).filter(row => Number(row.shopee_item_id) > 0);
    const unique = rows.filter((row, index) => rows.findIndex(other => normalizeShopeeConnectionId(other.connection_id) === normalizeShopeeConnectionId(row.connection_id) && String(other.shopee_item_id) === String(row.shopee_item_id)) === index);
    listings.push(...await Promise.all(unique.map(readShopeeListing)));
  }
  if (mlLinks.status === 'fulfilled') {
    const items = mlLinks.value.items.filter(item => item.product_id === productId);
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.item_id)) continue;
      seen.add(item.item_id);
      const listing: ChannelListing = { key: `ml-${item.item_id}`, channel: 'mercado_livre', label: 'Mercado Livre', reference: item.item_id, priceCents: null, editable: false, meta: { itemId: item.item_id, parentId: productId } };
      try {
        const current = await mercadoLivreService.getListingPrice(item.item_id, productId);
        listing.priceCents = Number(current.salePriceCents || current.priceCents) || null;
        listing.meta.listing = current;
      } catch (error) {
        listing.error = error instanceof Error ? error.message : 'Não foi possível consultar o Mercado Livre.';
      }
      listings.push(listing);
    }
  }
  if (tiktok.status === 'fulfilled' && tiktok.value?.tiktok_product_id) {
    const value: any = tiktok.value;
    listings.push({
      key: `tiktok-${value.tiktok_product_id}`, channel: 'tiktok', label: 'TikTok Shop', reference: `produto ${value.tiktok_product_id}`,
      priceCents: Number(value.price_cents) > 0 ? Number(value.price_cents) : null,
      editable: Boolean(value.tiktok_sku_id),
      error: value.price_cents === undefined ? 'Preço do TikTok disponível após publicar a atualização da API.' : undefined,
      meta: { tiktokProductId: value.tiktok_product_id, skuId: value.tiktok_sku_id, currency: value.price_currency || 'BRL' },
    });
  }
  return listings;
}

export async function updateListingPrice(listing: ChannelListing, priceCents: number) {
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error('Informe um preço válido.');
  if (listing.channel === 'site') {
    const saved: any = await vpsClient.patch(`/table-data/products/${encodeURIComponent(listing.meta.productId)}`, { price_retail: priceCents });
    // Celular com grupo de preço: o servidor mantém o preço do grupo e ignora o valor enviado.
    if (saved && Number(saved.price_retail) !== priceCents) {
      throw new Error('Este produto segue o grupo de preço do modelo (mesma memória). Altere o preço pelo grupo de preços no cadastro.');
    }
    return;
  }
  if (listing.channel === 'shopee_m' || listing.channel === 'shopee_g') {
    const { connectionId, itemId, modelId, models } = listing.meta;
    // Com variações a API completa as opções omitidas com o primeiro preço; manda todas com o preço atual.
    const priceList = modelId && Array.isArray(models) && models.length
      ? models.map((model: any) => ({ model_id: model.modelId, original_price: (model.modelId === modelId ? priceCents : model.priceCents) / 100 }))
      : [{ model_id: 0, original_price: priceCents / 100 }];
    if (priceList.some((row: any) => !(row.original_price > 0))) throw new Error('Não foi possível ler o preço atual de todas as opções do anúncio. Consulte novamente.');
    await fetchJson(withShopeeConnection('/api/shopee-catalog?action=update_price', connectionId), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, price_list: priceList }),
    });
    return;
  }
  if (listing.channel === 'tiktok') {
    await tiktokShopService.updatePrice({ product_id: listing.meta.tiktokProductId, sku_id: listing.meta.skuId, amount_cents: priceCents, currency: listing.meta.currency || 'BRL' });
    return;
  }
  throw new Error('Edite o preço do Mercado Livre pela opção "Editar no Mercado Livre".');
}

export type TikTokFeeSummary = {
  orders_considered: number; orders_with_statement: number; error_count: number; errors: Array<{ code: number | null; message: string }>;
  revenue_cents: number; currency: string | null; fields: Array<{ path: string; total_cents: number; orders: number; pct_of_revenue: number | null }>;
};
export function loadTikTokFeeSummary(limit = 20): Promise<TikTokFeeSummary> {
  return vpsClient.get(`/tiktok-shop/finance/fee-summary?limit=${limit}`, { timeoutMs: 60000 });
}
