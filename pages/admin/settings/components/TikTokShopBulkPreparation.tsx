import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../../../services/products';
import {
  notifyTikTokProductLinksUpdated,
  tiktokShopService,
  type TikTokShopProductLink,
} from '../../../../services/tiktokShopService';
import { vpsApiService } from '../../../../services/vpsApiService';
import type { Product } from '../../../../types/product';
import { buildTikTokBulkVariationGroups } from '../../../../utils/tiktokBulkVariationGroups';

type Action = 'Criar rascunhos' | 'Publicar rascunhos' | 'Reenviar rascunhos' | 'Atualizar anuncios';

function titleNeedsCompatibilityWording(name?: string | null) {
  return /\bpara\b/i.test(String(name || ''));
}

function hasProductImage(product: Product) {
  return Boolean(product.images?.length || product.image_url);
}

function diagnostic(product: Product, link?: TikTokShopProductLink, correction?: string, isGroupParent = Boolean(product.is_parent), groupChildren: Product[] = []) {
  if (correction) return { label: 'Corrigir antes de enviar', detail: correction, ok: false };
  if (link?.video_uploaded === false) return { label: 'Enviado sem video', detail: 'O anuncio foi enviado normalmente, sem video.', ok: true };
  if (['ACTIVE', 'ACTIVATE'].includes(String(link?.status || '').toUpperCase())) {
    return { label: 'Atualizar', detail: 'Anuncio ja enviado: sera atualizado no TikTok Shop.', ok: true };
  }
  if (isGroupParent) return { label: 'Grupo de variacoes', detail: 'Sera criado um unico anuncio com todos os SKUs filhos.', ok: true };
  if (product.parent_id) return { label: 'Enviar pelo grupo pai', detail: 'Esta variacao sera incluida no anuncio do produto pai.', ok: false };
  if (titleNeedsCompatibilityWording(product.name)) return { label: 'Titulo ajustado', detail: 'O envio troca “para” por “Compativel com”.', ok: true };
  if (!product.category_id) return { label: 'Categoria nao mapeada', detail: 'Mapeie a categoria TikTok no preparo.', ok: false };
  if (!product.sku || !(product.eans || []).some(Boolean)) return { label: 'Identificador obrigatorio ausente', detail: 'Informe SKU e EAN.', ok: false };
  if (!hasProductImage(product) && !groupChildren.some(hasProductImage)) return { label: 'Sem midia', detail: 'Inclua ao menos uma imagem no pai ou em uma variacao.', ok: false };
  if (!product.description?.trim()) return { label: 'Precisa de dados', detail: 'Adicione a descricao do anuncio.', ok: false };
  if (Number(product.stock_quantity || 0) <= 0) return { label: 'Precisa de dados', detail: 'Informe estoque positivo.', ok: false };
  return { label: 'Pronto', detail: link?.status === 'DRAFT' ? 'Rascunho pronto para publicar.' : 'Pronto para criar rascunho.', ok: true };
}

function progressStyle(status: string) {
  if (status === 'Rascunho criado - enviado sem video') return { card: 'border-amber-200 bg-amber-50', name: 'text-amber-950', status: 'text-amber-700', icon: AlertCircle };
  if (status === 'Rascunho criado') return { card: 'border-emerald-200 bg-emerald-50', name: 'text-emerald-900', status: 'text-emerald-700', icon: CheckCircle2 };
  if (status.startsWith('Falha')) return { card: 'border-rose-200 bg-rose-50', name: 'text-rose-900', status: 'text-rose-700', icon: AlertCircle };
  return { card: 'border-slate-200 bg-white', name: 'text-slate-950', status: 'text-slate-600', icon: Loader2 };
}

export default function TikTokShopBulkPreparation() {
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<Record<string, TikTokShopProductLink>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState('positive');
  const [state, setState] = useState('NOT_SENT');
  const [running, setRunning] = useState(false);
  const [draftProgress, setDraftProgress] = useState<Record<string, string>>({});
  const [completedDraftIds, setCompletedDraftIds] = useState<string[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await productService.list();
        const { links: found } = await tiktokShopService.getProductLinks(loaded.map((product) => product.id));
        if (!cancelled) {
          setProducts(loaded);
          setLinks(Object.fromEntries(found.map((link) => [link.product_id, link])));
        }
      } catch (error) {
        console.error('[TikTokShopBulkPreparation] load error:', error);
        if (!cancelled) toast.error('Nao foi possivel carregar o lote TikTok.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))] as string[], [products]);
  const variationGroups = useMemo(() => buildTikTokBulkVariationGroups(products), [products]);
  const rows = useMemo(() => {
    const matchesFilters = (product: Product) => {
    const groupChildren = variationGroups.childrenByParent.get(product.id) || [];
    const item = diagnostic(product, links[product.id], corrections[product.id], variationGroups.parentIds.has(product.id), groupChildren);
    const rawTikTokState = String(links[product.id]?.status || 'NOT_SENT').toUpperCase();
    const tiktokState = rawTikTokState === 'ACTIVATE' ? 'ACTIVE' : rawTikTokState;
    const searchable = `${product.name} ${product.sku} ${product.brand} ${product.category_id}`.toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase()))
      && (!brand || product.brand === brand)
      && (stock === 'all' || (stock === 'positive' ? Number(product.stock_quantity || 0) > 0 : Number(product.stock_quantity || 0) <= 0))
      && (state === 'all' || tiktokState === state)
      && (state !== 'READY' || item.ok);
    };

    return products.filter((product) => {
      const groupChildren = variationGroups.childrenByParent.get(product.id) || [];
      if (variationGroups.parentIds.has(product.id)) {
        return matchesFilters(product) || groupChildren.some((child: Product) => matchesFilters(child));
      }
      if (variationGroups.parentIdByChild.has(product.id)) return false;
      return matchesFilters(product);
    });
  }, [brand, corrections, links, products, query, state, stock, variationGroups]);

  async function run(action: Action) {
    const chosen = products.filter((product) =>
      selected.includes(product.id) &&
      !variationGroups.parentIdByChild.has(product.id) &&
      diagnostic(product, links[product.id], corrections[product.id], variationGroups.parentIds.has(product.id), variationGroups.childrenByParent.get(product.id) || []).ok
    );
    if (!chosen.length) return toast.error('Selecione ao menos um anuncio elegivel.');
    if (!window.confirm(`${action} para ${chosen.length} anuncio(s)?`)) return;

    if (action === 'Criar rascunhos') {
      setRunning(true);
      setCompletedDraftIds([]);
      setDraftProgress(Object.fromEntries(chosen.map((product) => [product.id, 'Na fila'])));
      window.requestAnimationFrame(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

      try {
        const warehouseResult = await tiktokShopService.getWarehouses();
        const warehouse = warehouseResult.warehouses.find((item) => item.is_default) || warehouseResult.warehouses[0];
        if (!warehouse) throw new Error('Nenhum armazem TikTok disponivel para o lote.');

        const results = await Promise.allSettled(chosen.map(async (product) => {
          try {
            const groupChildren = variationGroups.childrenByParent.get(product.id) || [];
            if (groupChildren.length > 0) {
              const grouped = await vpsApiService.updateProductVariationGroup(
                product.id,
                [product.id, ...groupChildren.map((child: Product) => child.id)]
              );
              if (!grouped.ok) throw new Error('Nao foi possivel consolidar as variacoes no produto pai.');
            }

            const mapping = await tiktokShopService.getCategoryMapping(String(product.category_id || ''));
            if (!mapping.mapping) throw new Error('Categoria nao mapeada');

            let job = await tiktokShopService.startDraftJob({
              product_id: product.id,
              category_id: mapping.mapping.tiktok_category_id,
              category_name: mapping.mapping.tiktok_category_name,
              warehouse_id: warehouse.id,
            });
            setDraftProgress((current) => ({ ...current, [product.id]: 'Enviando rascunho' }));

            for (let attempt = 0; attempt < 120 && !['completed', 'error'].includes(job.status); attempt += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 1000));
              job = await tiktokShopService.getDraftJob(job.job_id);
            }
            if (job.status !== 'completed') throw new Error(job.error?.message || 'Tempo limite ao criar rascunho');

            if (job.result) {
              setLinks((current) => ({
                ...current,
                [product.id]: {
                  product_id: product.id,
                  tiktok_product_id: job.result!.tiktok_product_id,
                  tiktok_sku_id: job.result!.tiktok_sku_id,
                  status: job.result!.status,
                  last_synced_at: new Date().toISOString(),
                  video_uploaded: job.result!.video_uploaded,
                },
              }));
            }
            setDraftProgress((current) => ({
              ...current,
              [product.id]: job.result?.video_uploaded === false
                ? 'Rascunho criado - enviado sem video'
                : 'Rascunho criado',
            }));
            return product.id;
          } catch (error: any) {
            const message = error?.message || 'Erro ao enviar o anuncio.';
            setCorrections((current) => ({ ...current, [product.id]: message }));
            setDraftProgress((current) => ({ ...current, [product.id]: `Falha: ${message}` }));
            throw error;
          }
        }));

        const failed = results.filter((result) => result.status === 'rejected').length;
        const completed = results
          .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
          .map((result) => result.value);
        setCompletedDraftIds(completed);
        if (completed.length > 0) notifyTikTokProductLinksUpdated(completed);
        toast[failed ? 'warning' : 'success'](`Rascunhos iniciados: ${chosen.length - failed}${failed ? `; ${failed} bloqueado(s)` : ''}.`);
      } catch (error: any) {
        toast.error(error?.message || 'Nao foi possivel iniciar os rascunhos do lote.');
      } finally {
        setRunning(false);
      }
      return;
    }

    const candidates = chosen.filter((product) =>
      diagnostic(product, links[product.id], corrections[product.id], variationGroups.parentIds.has(product.id), variationGroups.childrenByParent.get(product.id) || []).ok &&
      links[product.id]
    );
    if (!candidates.length) return toast.error('Nenhum item selecionado possui vinculo TikTok para esta acao.');

    setRunning(true);
    try {
      const results = await Promise.allSettled(candidates.map((product) => tiktokShopService.publishDraft(product.id)));
      const failed = results.filter((result) => result.status === 'rejected').length;
      const publishedLinks = results
        .filter((result): result is PromiseFulfilledResult<TikTokShopProductLink> => result.status === 'fulfilled')
        .map((result) => result.value);
      if (publishedLinks.length > 0) {
        setLinks((current) => ({
          ...current,
          ...Object.fromEntries(publishedLinks.map((link) => [link.product_id, link])),
        }));
        notifyTikTokProductLinksUpdated(publishedLinks.map((link) => link.product_id));
      }
      toast[failed ? 'warning' : 'success'](`${action}: ${candidates.length - failed} concluido(s)${failed ? `, ${failed} com falha` : ''}.`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Envio em massa</h2>
          <p className="text-sm text-slate-600">Diagnostico do catalogo e acoes por lote para o TikTok Shop.</p>
        </div>
        <p className="text-sm text-slate-600">{selected.length} selecionado(s)</p>
      </div>

      {Object.keys(draftProgress).length > 0 && (
        <div ref={progressRef} tabIndex={-1} className="mt-4 scroll-mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-950">Progresso do lote</p>
              <p className="text-xs text-slate-600">Acompanhe cada anuncio enquanto os rascunhos sao enviados.</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {Object.keys(draftProgress).length} anuncio(s)
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {products.filter((product) => draftProgress[product.id]).map((product) => {
              const status = draftProgress[product.id];
              const style = progressStyle(status);
              const Icon = style.icon;
              return (
                <div key={product.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${style.card}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${status === 'Rascunho criado' ? 'text-emerald-600' : status === 'Rascunho criado - enviado sem video' ? 'text-amber-600' : status.startsWith('Falha') ? 'text-rose-600' : 'animate-spin text-slate-500'}`} />
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${style.name}`}>{product.name}</p>
                    <p className={`text-xs font-medium ${style.status}`}>{status}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {completedDraftIds.length > 0 && (
            <button type="button" onClick={() => { setSelected(completedDraftIds); void run('Publicar rascunhos'); }} className="mt-4 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              Publicar rascunhos criados ({completedDraftIds.length})
            </button>
          )}
        </div>
      )}

      {Object.keys(corrections).length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-rose-600" /><div><p className="font-semibold text-rose-950">Lista de correcoes ({Object.keys(corrections).length})</p><p className="text-xs text-rose-700">Estes anuncios ficam bloqueados ate a correcao ser feita.</p></div></div>
          <div className="mt-3 grid gap-2">
            {products.filter((product) => corrections[product.id]).map((product) => (
              <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-white p-3">
                <div className="min-w-0"><p className="font-semibold text-slate-950">{product.name}</p><p className="mt-1 text-sm text-rose-700">{corrections[product.id]}</p></div>
                <button type="button" onClick={() => window.location.assign(`/admin/settings/tiktok-shop?product_id=${encodeURIComponent(product.id)}`)} className="shrink-0 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Corrigir anuncio</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, SKU, categoria ou marca" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
        <select value={brand} onChange={(event) => setBrand(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Todas as marcas</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={stock} onChange={(event) => setStock(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">Todo estoque</option><option value="positive">Com estoque</option><option value="empty">Sem estoque</option></select>
        <select value={state} onChange={(event) => setState(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">Toda situacao TikTok</option><option value="NOT_SENT">Nao enviado</option><option value="DRAFT">Rascunho</option><option value="ACTIVE">Publicado</option><option value="READY">Prontos</option></select>
        <button type="button" onClick={() => setSelected(rows.filter((product) => diagnostic(product, links[product.id], corrections[product.id], variationGroups.parentIds.has(product.id), variationGroups.childrenByParent.get(product.id) || []).ok).map((product) => product.id))} className="rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700">Selecionar prontos filtrados</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[850px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Selecionar</th><th className="p-3">Anuncio / SKUs</th><th className="p-3">Diagnostico</th><th className="p-3">Venda / custo</th><th className="p-3">Lucro / margem</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="p-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando...</td></tr> : rows.map((product) => {
              const isGroupParent = variationGroups.parentIds.has(product.id);
              const item = diagnostic(product, links[product.id], corrections[product.id], isGroupParent, variationGroups.childrenByParent.get(product.id) || []);
              const sale = Number(product.price_retail || 0) / 100;
              const cost = Number(product.price_cost || 0) / 100;
              const profit = sale - cost;
              const variationCount = (variationGroups.childrenByParent.get(product.id) || []).length;
              return <tr key={product.id} className={isGroupParent ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : item.ok ? '' : 'bg-amber-50/50'}><td className="p-3"><input type="checkbox" disabled={!item.ok} checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} /></td><td className="p-3"><p className="font-semibold text-slate-950">{product.name}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">{isGroupParent ? <><span className="rounded-full bg-teal-700 px-2 py-0.5 font-semibold text-white">Produto pai</span><span>{variationCount} variacao(oes) / SKU(s) serao enviados juntos</span></> : <>{product.sku || 'Sem SKU'} · 1 SKU</>}</p></td><td className="p-3"><p className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${item.ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{item.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{item.label}</p><p className="mt-1 text-xs text-slate-600">{item.detail}</p></td><td className="p-3">R$ {sale.toFixed(2)} / R$ {cost.toFixed(2)}</td><td className="p-3">R$ {profit.toFixed(2)} / {sale ? ((profit / sale) * 100).toFixed(1) : '0.0'}%</td></tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">{(['Criar rascunhos', 'Publicar rascunhos', 'Reenviar rascunhos', 'Atualizar anuncios'] as Action[]).map((action) => <button key={action} type="button" disabled={running} onClick={() => void run(action)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{action}</button>)}</div>
      <p className="mt-3 text-xs text-slate-500">Cada rascunho usa o mapeamento de categoria e o armazem TikTok configurados; os itens sem esses dados permanecem bloqueados.</p>
    </section>
  );
}
