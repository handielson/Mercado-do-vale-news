import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, FileText, PackagePlus, RefreshCw, ShoppingCart, Store, XCircle } from 'lucide-react';
import { getDashboardSalesDigest } from '../../../services/dashboardSalesDigestService';
import { buildPurchaseQueueClipboardText, createManualPurchaseRequest, getPurchaseQueueItems, syncPurchaseQueueFromSummary, updatePurchaseQueueItemStatus } from '../../../services/purchaseQueueService.js';
import { vpsApiService } from '../../../services/vpsApiService';

type QueueItem = Awaited<ReturnType<typeof getPurchaseQueueItems>>[number];
type View = 'pending' | 'quoted' | 'purchased' | 'removed';

const money = (cents: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
const statusLabel: Record<string, string> = { pending: 'Pendente', quoted: 'Orçado', purchased: 'Comprado', not_purchased: 'Não comprado', removed: 'Retirado' };
const sourceLabel: Record<string, string> = { daily_sales: 'Vendas do dia', manual_existing: 'Pedido por SKU', manual_new: 'Item novo' };

function Status({ status }: { status: string }) {
  const color = status === 'purchased' ? 'bg-emerald-100 text-emerald-700' : status === 'quoted' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{statusLabel[status] || 'Pendente'}</span>;
}

export const DashboardPurchaseQueue: React.FC = () => {
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [view, setView] = React.useState<View>('pending');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showRequest, setShowRequest] = React.useState(false);
  const [products, setProducts] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ kind: 'existing', productId: '', name: '', sku: '', stock: '0', quantity: '1' });

  const load = React.useCallback(async (sync = true) => {
    setLoading(true); setError('');
    try {
      if (sync) {
        const digest = await getDashboardSalesDigest();
        const date = digest.referenceDate ? new Date(`${digest.referenceDate}T12:00:00`) : new Date();
        await syncPurchaseQueueFromSummary(digest.summaryRows, date);
      }
      setItems(await getPurchaseQueueItems());
    } catch (err) { console.error(err); setError('Não foi possível atualizar a fila agora.'); try { setItems(await getPurchaseQueueItems()); } catch { /* mantém a mensagem */ } }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(true); }, [load]);
  React.useEffect(() => {
    if (!showRequest || products.length) return;
    vpsApiService.getProducts({ status: 'active', limit: 1000, compact: true, noCache: true }).then((rows: any[]) => setProducts(rows || [])).catch(() => setError('Não foi possível carregar o catálogo para selecionar o SKU.'));
  }, [showRequest, products.length]);

  const counts = React.useMemo(() => ({ pending: items.filter(i => i.status === 'pending').length, quoted: items.filter(i => i.status === 'quoted').length, purchased: items.filter(i => i.status === 'purchased').length, removed: items.filter(i => ['removed', 'not_purchased'].includes(i.status)).length }), [items]);
  const visible = items.filter((item) => view === 'removed' ? ['removed', 'not_purchased'].includes(item.status) : item.status === view);

  const selectProduct = (id: string) => {
    const p = products.find(product => String(product.id) === id);
    setForm(prev => ({ ...prev, productId: id, name: p?.name || p?.model || '', sku: p?.sku || '', stock: String(p?.stock_quantity ?? p?.stock ?? 0) }));
  };
  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createManualPurchaseRequest({ productId: form.kind === 'existing' ? form.productId : null, model: form.name, sku: form.sku, currentStock: Number(form.stock), requestedQuantity: Number(form.quantity), sourceType: form.kind === 'existing' ? 'manual_existing' : 'manual_new' });
      setForm({ kind: 'existing', productId: '', name: '', sku: '', stock: '0', quantity: '1' }); setShowRequest(false); await load(false);
    } catch (err: any) { setError(err?.message || 'Não foi possível incluir o item.'); }
  };
  const dismiss = async (item: QueueItem) => {
    const reason = window.prompt('Informe o motivo para retirar este item:', item.reason || '');
    if (!reason?.trim()) return;
    try { setItems(await updatePurchaseQueueItemStatus(item.id, 'removed', reason)); } catch { setError('Não foi possível retirar o item.'); }
  };
  const copy = async () => { const text = buildPurchaseQueueClipboardText(items.filter(i => ['pending', 'quoted'].includes(i.status))); try { await navigator.clipboard.writeText(text); window.alert('Lista copiada.'); } catch { window.alert(text); } };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div><h3 className="font-bold text-slate-900">Central de compras</h3><p className="mt-1 text-sm text-slate-500">Acompanhe vendas, estoque, orçamentos e compras concluídas em um só lugar.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/admin/compras/fornecedores" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"><Store size={16}/> Fornecedores</Link><button onClick={() => setShowRequest(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><PackagePlus size={16}/> Novo item</button><button onClick={() => load(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Atualizar fila</button><button onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"><ClipboardList size={16}/> Copiar</button></div>
    </div>

    {showRequest && <form onSubmit={submitRequest} className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
      <div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-blue-950">Incluir na lista de compra</h4><p className="text-sm text-blue-800">Use um produto cadastrado por SKU ou crie uma solicitação para um item ainda inexistente.</p></div><button type="button" onClick={() => setShowRequest(false)} className="text-sm font-semibold text-blue-800">Fechar</button></div>
      <div className="mb-4 flex gap-5 text-sm font-semibold text-slate-700"><label><input type="radio" checked={form.kind === 'existing'} onChange={() => setForm(p => ({ ...p, kind: 'existing' }))}/> Produto cadastrado</label><label><input type="radio" checked={form.kind === 'new'} onChange={() => setForm(p => ({ ...p, kind: 'new', productId: '' }))}/> Item novo</label></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {form.kind === 'existing' && <select value={form.productId} onChange={e => selectProduct(e.target.value)} required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Selecione pelo SKU / produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} — ` : ''}{p.name || p.model}</option>)}</select>}
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Nome do item" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="SKU (opcional para item novo)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input type="number" min="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} placeholder="Estoque atual" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} required placeholder="Quantidade a comprar" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div><button className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Adicionar à lista</button>
    </form>}

    <div className="grid gap-3 md:grid-cols-4">{(['pending', 'quoted', 'purchased', 'removed'] as View[]).map(tab => <button key={tab} onClick={() => setView(tab)} className={`rounded-2xl border p-4 text-left ${view === tab ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><p className="text-xs font-bold uppercase tracking-wide">{tab === 'pending' ? 'Lista principal' : tab === 'quoted' ? 'Orçamentos' : tab === 'purchased' ? 'Compras efetuadas' : 'Retirados'}</p><p className="mt-1 text-2xl font-bold">{counts[tab]}</p></button>)}</div>
    {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Item</th><th className="px-4 py-4">Vendas / estoque</th><th className="px-4 py-4">Solicitação</th><th className="px-4 py-4">Orçamentos</th><th className="px-4 py-4">Status</th><th className="px-5 py-4 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">
      {visible.map(item => <tr key={item.id}><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.model}</p><p className="text-xs text-slate-500">{item.sku || 'Sem SKU'} · {sourceLabel[item.source_type] || 'Vendas do dia'}</p></td><td className="px-4 py-4"><p>{item.source_type === 'daily_sales' ? `${item.last_digest_quantity || 0} vendidas hoje` : 'Pedido manual'}</p><p className="text-xs text-slate-500">Estoque atual: {item.current_stock || 0}</p></td><td className="px-4 py-4 font-semibold">{item.requested_quantity || '—'}</td><td className="px-4 py-4">{item.quote_count ? <><p className="font-bold text-emerald-700">Menor: {money(item.lowest_quote_price_cents)}</p><p className="text-xs text-slate-500">{item.quote_count} loja(s)</p></> : <span className="text-slate-400">Sem orçamento</span>}</td><td className="px-4 py-4"><Status status={item.status}/></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">{item.status !== 'purchased' && <Link to={`/admin/compras/${item.id}/orcamentos`} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700"><Store size={14}/> Orçar</Link>}{item.status !== 'purchased' && <button onClick={() => dismiss(item)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><XCircle size={14}/></button>}{item.status === 'purchased' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> {item.purchased_supplier_name}</span>}</div></td></tr>)}
      {!loading && !visible.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Nenhum item nesta lista.</td></tr>}
    </tbody></table></div></div>
  </div>;
};
