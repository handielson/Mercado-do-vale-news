import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileText, PackagePlus, Plus, RefreshCw, Search, ShoppingBag, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../../services/products';
import { bestQuoteFromItem, shoppingListService } from '../../../services/shoppingListService';
import type { ShoppingListItem, ShoppingListItemStatus } from '../../../types/shopping-list';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const statusMeta: Record<ShoppingListItemStatus, { label: string; className: string }> = {
  pending: { label: 'Sem orçamento', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  quoted: { label: 'Orçado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  purchased: { label: 'Comprado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function ShoppingListPage() {
  const { customer } = useSupabaseAuth();
  const [items, setItems] = React.useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | ShoppingListItemStatus>('all');
  const [search, setSearch] = React.useState('');
  const [productQuery, setProductQuery] = React.useState('');
  const [productResults, setProductResults] = React.useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null);
  const [manualQty, setManualQty] = React.useState(1);
  const [loose, setLoose] = React.useState({ name: '', sku: '', quantity: 1, notes: '' });
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async (sync = false) => {
    try {
      if (sync) {
        setSyncing(true);
        const count = await shoppingListService.syncTodaySales();
        if (count) toast.success(`${count} item(ns) das vendas de hoje foram atualizados.`);
      }
      setItems(await shoppingListService.listItems());
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Não foi possível carregar a lista de compras.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  React.useEffect(() => { load(true); }, [load]);

  React.useEffect(() => {
    if (productQuery.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try { setProductResults(await productService.search(productQuery)); } catch { setProductResults([]); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productQuery]);

  const addRegistered = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct || manualQty < 1) return;
    setAdding(true);
    try {
      await shoppingListService.addRegisteredProduct({
        productId: selectedProduct.id, quantity: manualQty, operatorName: customer?.name || 'Operador',
      });
      setSelectedProduct(null); setProductQuery(''); setManualQty(1); setProductResults([]);
      await load(); toast.success('Produto cadastrado adicionado à lista.');
    } catch (error: any) { toast.error(error.message || 'Não foi possível incluir o produto.'); }
    finally { setAdding(false); }
  };

  const addLoose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loose.name.trim() || loose.quantity < 1) return;
    setAdding(true);
    try {
      await shoppingListService.addLooseItem({ itemName: loose.name.trim(), sku: loose.sku.trim(), quantity: loose.quantity, notes: loose.notes.trim(), operatorName: customer?.name || 'Operador' });
      setLoose({ name: '', sku: '', quantity: 1, notes: '' });
      await load(); toast.success('Item avulso adicionado à lista.');
    } catch (error: any) { toast.error(error.message || 'Não foi possível incluir o item avulso.'); }
    finally { setAdding(false); }
  };

  const cancel = async (item: ShoppingListItem) => {
    const reason = window.prompt(`Motivo para cancelar “${item.item_name}”:`);
    if (!reason?.trim()) return;
    try { await shoppingListService.cancelItem(item.id, reason); await load(); toast.success('Item cancelado.'); }
    catch (error: any) { toast.error(error.message || 'Não foi possível cancelar o item.'); }
  };

  const visibleItems = items.filter((item) => {
    const matchesStatus = filter === 'all' || item.status === filter;
    const term = search.toLowerCase();
    return matchesStatus && (!term || item.item_name.toLowerCase().includes(term) || item.sku?.toLowerCase().includes(term));
  });

  const totals = items.reduce((acc, item) => { acc[item.status]++; return acc; }, { pending: 0, quoted: 0, purchased: 0, cancelled: 0 });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><ClipboardList size={30} /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Lista de Compras</h1><p className="mt-1 text-sm text-slate-500">Reposição por vendas do dia, estoque atual e solicitações manuais.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => load(true)} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Atualizar vendas de hoje</button>
          <Link to="/admin/compras/orcamentos" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"><FileText size={16} /> Orçamentos</Link>
          <Link to="/admin/compras/efetuadas" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><ShoppingBag size={16} /> Compras efetuadas</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['pending', 'quoted', 'purchased', 'cancelled'] as ShoppingListItemStatus[]).map((status) => <button key={status} onClick={() => setFilter(filter === status ? 'all' : status)} className={`rounded-2xl border p-4 text-left ${filter === status ? statusMeta[status].className : 'border-slate-200 bg-white'}`}><p className="text-xs font-semibold uppercase tracking-wide">{statusMeta[status].label}</p><p className="mt-2 text-2xl font-bold">{totals[status]}</p></button>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={addRegistered} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-800"><PackagePlus size={20} className="text-indigo-600" /><h2 className="font-bold">Adicionar produto cadastrado</h2></div>
          <div className="relative">
            <label className="text-sm font-medium text-slate-700">Pesquisar por nome ou SKU</label>
            <input value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku || 'sem SKU'})` : productQuery} onChange={(e) => { setSelectedProduct(null); setProductQuery(e.target.value); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Digite ao menos 2 caracteres" />
            {!selectedProduct && productResults.length > 0 && <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">{productResults.map((product) => <button type="button" key={product.id} onClick={() => { setSelectedProduct(product); setProductResults([]); }} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"><span className="font-semibold text-slate-800">{product.name}</span><span className="ml-2 font-mono text-xs text-slate-500">{product.sku || 'sem SKU'}</span></button>)}</div>}
          </div>
          <div className="mt-3 flex gap-3"><label className="flex-1 text-sm font-medium text-slate-700">Quantidade<input type="number" min="1" value={manualQty} onChange={(e) => setManualQty(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><button disabled={!selectedProduct || adding} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Plus size={16} /> Adicionar</button></div>
        </form>

        <form onSubmit={addLoose} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-800"><Plus size={20} className="text-indigo-600" /><h2 className="font-bold">Solicitar item avulso</h2></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Identificação do item<input required value={loose.name} onChange={(e) => setLoose({ ...loose, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Ex.: caixa de etiquetas" /></label><label className="text-sm font-medium text-slate-700">SKU (opcional)<input value={loose.sku} onChange={(e) => setLoose({ ...loose, sku: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-medium text-slate-700">Quantidade<input required min="1" type="number" value={loose.quantity} onChange={(e) => setLoose({ ...loose, quantity: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-medium text-slate-700">Observação<input value={loose.notes} onChange={(e) => setLoose({ ...loose, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label></div>
          <button disabled={adding} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Plus size={16} /> Adicionar item avulso</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Lista principal</h2><p className="text-sm text-slate-500">O menor preço aparece aqui assim que houver cotação válida.</p></div><label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item ou SKU" className="rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" /></label></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3 text-right">Vendas hoje</th><th className="px-5 py-3 text-right">Estoque</th><th className="px-5 py-3 text-right">Solicitado</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Menor preço válido</th><th className="px-5 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">Carregando lista…</td></tr> : visibleItems.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">Nenhum item encontrado.</td></tr> : visibleItems.map((item) => { const best = bestQuoteFromItem(item); return <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.item_name}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{item.sku || 'Item sem SKU'} · {item.source_type === 'daily_sales' ? 'Vendas do dia' : item.source_type === 'manual_item' ? 'Avulso' : 'Manual'}</p></td><td className="px-5 py-4 text-right">{item.sales_quantity_today || '—'}</td><td className="px-5 py-4 text-right">{item.current_stock}</td><td className="px-5 py-4 text-right font-semibold">{item.requested_quantity}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta[item.status].className}`}>{statusMeta[item.status].label}</span></td><td className="px-5 py-4">{best ? <div><p className="font-bold text-emerald-700">{money(best.unit_price)}</p><p className="text-xs text-slate-500">{best.supplier_name}{best.purchase_location ? ` · ${best.purchase_location}` : ''}</p></div> : <span className="text-slate-400">Sem orçamento</span>}</td><td className="px-5 py-4"><div className="flex gap-2"><Link to={`/admin/compras/${item.id}/orcamentos`} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{item.status === 'pending' ? 'Orçar' : 'Ver orçamento'}</Link>{(item.status === 'pending' || item.status === 'quoted') && <button onClick={() => cancel(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><XCircle size={13} /> Cancelar</button>}</div></td></tr>; })}</tbody></table></div>
      </div>
    </div>
  );
}
