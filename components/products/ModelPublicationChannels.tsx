import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { shopeeProductService, getShopeeStoreCode } from '../../services/shopeeProducts';
import { listShopeeConnections, normalizeShopeeConnectionId } from '../../services/shopeeConnections';
import { mercadoLivreService } from '../../services/mercadoLivreService';
import { tiktokShopService, type TikTokShopProductLink } from '../../services/tiktokShopService';
import { buildShopeeProductUrl } from './productCardShopee.js';

// model-channels-v1: canais de venda (Shopee/ML/TikTok) da família, carregados uma vez para todos os SKUs.
export type ShopeeChannelLink = { code: 'M' | 'G'; itemId: number; url: string | null };
export type MlChannelLink = { itemId: string; variationId?: string; hasError: boolean };
export type ProductChannels = { shopee: ShopeeChannelLink[]; ml: MlChannelLink[]; tiktok: TikTokShopProductLink | null; tiktokInherited: boolean };
export type ModelChannelsState = { loading: boolean; failed: boolean; byProductId: Record<string, ProductChannels> };

const EMPTY: ProductChannels = { shopee: [], ml: [], tiktok: null, tiktokInherited: false };

export function useModelPublicationChannels(productIds: string[], parentId: string | null) {
  const key = [...new Set(productIds.filter(Boolean))].sort().join(',');
  const [state, setState] = useState<ModelChannelsState>({ loading: false, failed: false, byProductId: {} });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) return;
    let active = true;
    setState(previous => ({ ...previous, loading: true }));
    const idSet = new Set(ids);
    void Promise.allSettled([
      shopeeProductService.list(),
      listShopeeConnections(),
      mercadoLivreService.getProductLinks(),
      tiktokShopService.getProductLinks(ids),
    ]).then(([shopeeRows, connections, ml, tiktok]) => {
      if (!active) return;
      const shopIdByConnection = new Map((connections.status === 'fulfilled' ? connections.value : [])
        .map(connection => [normalizeShopeeConnectionId(connection.id), connection.shopee_shop_id]));
      const result: Record<string, ProductChannels> = {};
      const entry = (id: string) => (result[id] ||= { shopee: [], ml: [], tiktok: null, tiktokInherited: false });
      if (shopeeRows.status === 'fulfilled') {
        for (const row of shopeeRows.value) {
          const id = String(row.product_id || '');
          const itemId = Number(row.shopee_item_id);
          if (!idSet.has(id) || !Number.isFinite(itemId) || itemId <= 0) continue;
          const code = getShopeeStoreCode(row.connection_id);
          const target = entry(id).shopee;
          if (target.some(link => link.code === code && link.itemId === itemId)) continue;
          target.push({ code, itemId, url: buildShopeeProductUrl(shopIdByConnection.get(normalizeShopeeConnectionId(row.connection_id)) || '', itemId) });
        }
      }
      if (ml.status === 'fulfilled') {
        for (const item of ml.value.items || []) {
          const id = String(item.product_id || '');
          if (!idSet.has(id)) continue;
          entry(id).ml.push({ itemId: item.item_id, variationId: item.variation_id, hasError: Boolean(item.last_error) });
        }
      }
      if (tiktok.status === 'fulfilled') {
        for (const link of tiktok.value.links || []) {
          const id = String(link.product_id || '');
          if (idSet.has(id) && link.tiktok_product_id) entry(id).tiktok = link;
        }
        // Mesma regra do card: variação sem vínculo próprio herda o anúncio TikTok do pai.
        const parentLink = parentId ? result[parentId]?.tiktok : null;
        if (parentLink) for (const id of ids) if (id !== parentId && !result[id]?.tiktok) Object.assign(entry(id), { tiktok: parentLink, tiktokInherited: true });
      }
      setState({ loading: false, failed: [shopeeRows, ml, tiktok].some(r => r.status === 'rejected'), byProductId: result });
    });
    return () => { active = false; };
  }, [key, parentId, refresh]);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  return { ...state, reload };
}

export function mergeChannels(productIds: string[], byProductId: Record<string, ProductChannels>): ProductChannels {
  const merged: ProductChannels = { shopee: [], ml: [], tiktok: null, tiktokInherited: false };
  for (const id of productIds) {
    const channels = byProductId[id] || EMPTY;
    for (const link of channels.shopee) if (!merged.shopee.some(l => l.code === link.code && l.itemId === link.itemId)) merged.shopee.push(link);
    for (const link of channels.ml) if (!merged.ml.some(l => l.itemId === link.itemId && l.variationId === link.variationId)) merged.ml.push(link);
    if (!merged.tiktok && channels.tiktok) { merged.tiktok = channels.tiktok; merged.tiktokInherited = channels.tiktokInherited; }
  }
  return merged;
}

function mlUrl(itemId: string) {
  const match = /^([A-Z]{3})(\d+)$/.exec(String(itemId).trim().toUpperCase());
  return match ? `https://produto.mercadolivre.com.br/${match[1]}-${match[2]}` : null;
}

function tiktokLabel(link: TikTokShopProductLink, inherited: boolean) {
  const status = String(link.status || '').toUpperCase();
  const text = ['ACTIVE', 'ACTIVATE'].includes(status) ? 'Publicado' : status === 'PENDING' ? 'Em análise' : status || 'Vinculado';
  return `${text}${inherited ? ' (pai)' : ''}`;
}

const chip = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold';

export function SkuChannelBadges({ channels, loading, onTikTok, mlManageUrl }: {
  channels: ProductChannels; loading: boolean; onTikTok: () => void; mlManageUrl: string;
}) {
  if (loading) return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" />Canais…</span>;
  const none = !channels.shopee.length && !channels.ml.length && !channels.tiktok;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {channels.shopee.map(link => {
        const cls = `${chip} ${link.code === 'G' ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`;
        const label = `Shopee ${link.code}`;
        return link.url
          ? <a key={`s-${link.code}-${link.itemId}`} href={link.url} target="_blank" rel="noreferrer" className={`${cls} hover:brightness-95`} title={`Abrir anúncio Shopee (item ${link.itemId})`}>{label}</a>
          : <span key={`s-${link.code}-${link.itemId}`} className={cls} title={`Item Shopee ${link.itemId}`}>{label}</span>;
      })}
      {channels.ml.map(link => {
        const url = mlUrl(link.itemId);
        const cls = `${chip} ${link.hasError ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-yellow-200 bg-yellow-50 text-yellow-900'}`;
        const title = `${link.itemId}${link.variationId ? ` · variação ${link.variationId}` : ''}${link.hasError ? ' · sincronização requer atenção' : ''}`;
        return <a key={`m-${link.itemId}-${link.variationId || ''}`} href={url || mlManageUrl} target={url ? '_blank' : undefined} rel="noreferrer" className={`${cls} hover:brightness-95`} title={title}>Mercado Livre{link.hasError ? ' ⚠' : ''}</a>;
      })}
      {channels.tiktok && <button type="button" onClick={onTikTok} className={`${chip} border-slate-700 bg-slate-900 text-white hover:bg-slate-800`} title={`TikTok Shop · produto ${channels.tiktok.tiktok_product_id}`}>TikTok: {tiktokLabel(channels.tiktok, channels.tiktokInherited)}</button>}
      {none && <span className="text-xs text-slate-400">Sem marketplace vinculado</span>}
    </div>
  );
}

export function ModelChannelsSummary({ skuCount, groups, loading, failed, onReload, parentChannels, onParentTikTok, parentMlManageUrl }: {
  skuCount: number; groups: ProductChannels[]; loading: boolean; failed: boolean; onReload: () => void;
  parentChannels?: ProductChannels | null; onParentTikTok?: () => void; parentMlManageUrl?: string;
}) {
  const parentHasLinks = Boolean(parentChannels && (parentChannels.shopee.length || parentChannels.ml.length || parentChannels.tiktok));
  const count = (predicate: (c: ProductChannels) => boolean) => groups.filter(predicate).length;
  const items = [
    { label: 'Shopee M', value: count(c => c.shopee.some(l => l.code === 'M')), cls: 'border-orange-200 bg-orange-50 text-orange-900' },
    { label: 'Shopee G', value: count(c => c.shopee.some(l => l.code === 'G')), cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900' },
    { label: 'Mercado Livre', value: count(c => c.ml.length > 0), cls: 'border-yellow-200 bg-yellow-50 text-yellow-900' },
    { label: 'TikTok Shop', value: count(c => Boolean(c.tiktok)), cls: 'border-slate-300 bg-slate-100 text-slate-900' },
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Canais de venda conectados</h2>
        <button type="button" onClick={onReload} disabled={loading} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar canais
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item.label} className={`${chip} ${item.value ? item.cls : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
            {item.label}: {loading ? '…' : `${item.value}/${skuCount} SKU${skuCount === 1 ? '' : 's'}`}
          </span>
        ))}
      </div>
      {!loading && parentHasLinks && parentChannels && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs font-semibold text-slate-500">Cadastro pai:</span>
        <SkuChannelBadges channels={parentChannels} loading={false} onTikTok={onParentTikTok || (() => undefined)} mlManageUrl={parentMlManageUrl || '/admin/settings/mercado-livre'} />
      </div>}
      {failed && <p className="mt-2 text-xs text-amber-800">Não foi possível consultar todos os canais. Isso não significa que o produto não está publicado.</p>}
    </section>
  );
}
