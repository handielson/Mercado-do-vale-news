import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../../../services/products';
import { tiktokShopService, type TikTokShopProductLink } from '../../../../services/tiktokShopService';
import type { Product } from '../../../../types/product';

type Action = 'Criar rascunhos' | 'Publicar rascunhos' | 'Reenviar rascunhos' | 'Atualizar anuncios';

function diagnostic(product: Product, link?: TikTokShopProductLink) {
  if (link?.status === 'ACTIVE') return { label: 'Ja publicado', detail: 'Use atualizar anuncio para reenviar os dados.', ok: true };
  if (!product.category_id) return { label: 'Categoria nao mapeada', detail: 'Mapeie a categoria TikTok no preparo.', ok: false };
  if (!product.sku || !(product.eans || []).some(Boolean)) return { label: 'Identificador obrigatorio ausente', detail: 'Informe SKU e EAN.', ok: false };
  if (!product.images?.length) return { label: 'Sem midia', detail: 'Inclua ao menos uma imagem.', ok: false };
  if (!product.description?.trim()) return { label: 'Precisa de dados', detail: 'Adicione a descricao do anuncio.', ok: false };
  if (product.is_parent) return { label: 'Precisa conversao para variacoes', detail: 'Revise o grupo e seus SKUs.', ok: false };
  if (Number(product.stock_quantity || 0) <= 0) return { label: 'Precisa de dados', detail: 'Informe estoque positivo.', ok: false };
  return { label: 'Pronto', detail: link?.status === 'DRAFT' ? 'Rascunho pronto para publicar.' : 'Pronto para criar rascunho.', ok: true };
}

export default function TikTokShopBulkPreparation() {
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<Record<string, TikTokShopProductLink>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState('all');
  const [state, setState] = useState('all');
  const [running, setRunning] = useState(false);

  useEffect(() => { let cancelled = false; (async () => { try { const loaded = await productService.list(); const { links: found } = await tiktokShopService.getProductLinks(loaded.map((product) => product.id)); if (!cancelled) { setProducts(loaded); setLinks(Object.fromEntries(found.map((link) => [link.product_id, link]))); } } catch (error) { console.error('[TikTokShopBulkPreparation] load error:', error); if (!cancelled) toast.error('Nao foi possivel carregar o lote TikTok.'); } finally { if (!cancelled) setLoading(false); } })(); return () => { cancelled = true; }; }, []);

  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))] as string[], [products]);
  const rows = useMemo(() => products.filter((product) => { const item = diagnostic(product, links[product.id]); const tiktokState = links[product.id]?.status || 'NOT_SENT'; const searchable = `${product.name} ${product.sku} ${product.brand} ${product.category_id}`.toLowerCase(); return (!query.trim() || searchable.includes(query.trim().toLowerCase())) && (!brand || product.brand === brand) && (stock === 'all' || (stock === 'positive' ? Number(product.stock_quantity || 0) > 0 : Number(product.stock_quantity || 0) <= 0)) && (state === 'all' || tiktokState === state) && (state !== 'READY' || item.ok); }), [brand, links, products, query, state, stock]);

  async function run(action: Action) {
    const chosen = products.filter((product) => selected.includes(product.id));
    if (!chosen.length) return toast.error('Selecione ao menos um anuncio elegivel.');
    if (!window.confirm(`${action} para ${chosen.length} anuncio(s)?`)) return;
    if (action === 'Criar rascunhos') { window.location.href = `/admin/settings/tiktok-shop?product_id=${encodeURIComponent(chosen[0].id)}`; return; }
    const candidates = chosen.filter((product) => diagnostic(product, links[product.id]).ok && links[product.id]);
    if (!candidates.length) return toast.error('Nenhum item selecionado possui vinculo TikTok para esta acao.');
    setRunning(true);
    try { const results = await Promise.allSettled(candidates.map((product) => tiktokShopService.publishDraft(product.id))); const failed = results.filter((result) => result.status === 'rejected').length; toast[failed ? 'warning' : 'success'](`${action}: ${candidates.length - failed} concluido(s)${failed ? `, ${failed} com falha` : ''}.`); } finally { setRunning(false); }
  }

  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Envio em massa</h2><p className="text-sm text-slate-600">Diagnostico do catalogo e acoes por lote para o TikTok Shop.</p></div><p className="text-sm text-slate-600">{selected.length} selecionado(s)</p></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, SKU, categoria ou marca" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" /><select value={brand} onChange={(event) => setBrand(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Todas as marcas</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={stock} onChange={(event) => setStock(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">Todo estoque</option><option value="positive">Com estoque</option><option value="empty">Sem estoque</option></select><select value={state} onChange={(event) => setState(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">Toda situacao TikTok</option><option value="NOT_SENT">Nao enviado</option><option value="DRAFT">Rascunho</option><option value="ACTIVE">Publicado</option><option value="READY">Prontos</option></select><button type="button" onClick={() => setSelected(rows.filter((product) => diagnostic(product, links[product.id]).ok).map((product) => product.id))} className="rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700">Selecionar prontos filtrados</button></div><div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Selecionar</th><th className="p-3">Anuncio / SKUs</th><th className="p-3">Diagnostico</th><th className="p-3">Venda / custo</th><th className="p-3">Lucro / margem</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="p-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando...</td></tr> : rows.map((product) => { const item = diagnostic(product, links[product.id]); const sale = Number(product.price_retail || 0) / 100; const cost = Number(product.price_cost || 0) / 100; const profit = sale - cost; return <tr key={product.id} className={item.ok ? '' : 'bg-amber-50/50'}><td className="p-3"><input type="checkbox" disabled={!item.ok} checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} /></td><td className="p-3"><p className="font-semibold">{product.name}</p><p className="text-xs text-slate-500">{product.sku || 'Sem SKU'} · {product.is_parent ? 'Grupo de variacoes' : '1 SKU'}</p></td><td className="p-3"><p className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${item.ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{item.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{item.label}</p><p className="mt-1 text-xs text-slate-600">{item.detail}</p></td><td className="p-3">R$ {sale.toFixed(2)} / R$ {cost.toFixed(2)}</td><td className="p-3">R$ {profit.toFixed(2)} / {sale ? ((profit / sale) * 100).toFixed(1) : '0.0'}%</td></tr>; })}</tbody></table></div><div className="mt-4 flex flex-wrap gap-2">{(['Criar rascunhos', 'Publicar rascunhos', 'Reenviar rascunhos', 'Atualizar anuncios'] as Action[]).map((action) => <button key={action} type="button" disabled={running} onClick={() => void run(action)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{action}</button>)}</div><p className="mt-3 text-xs text-slate-500">A criacao abre a revisao do primeiro item selecionado, pois categoria e armazem precisam de confirmacao. As demais acoes usam o vinculo TikTok ja salvo.</p></section>;
}
