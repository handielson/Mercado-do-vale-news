import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { bestQuoteFromItem, getBestQuote, shoppingListService } from '../../../services/shoppingListService';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import type { ShoppingListItem } from '../../../types/shopping-list';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);

export default function ShoppingQuotesPage() {
  const { id } = useParams();
  const { customer } = useSupabaseAuth();
  const [item, setItem] = React.useState<ShoppingListItem | null>(null);
  const [allQuoted, setAllQuoted] = React.useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [quote, setQuote] = React.useState({ supplierName: '', purchaseLocation: '', unitPrice: '', quantity: 1, quotedAt: today(), notes: '' });
  const [purchase, setPurchase] = React.useState({ supplierName: '', purchaseLocation: '', unitPrice: '', quantity: 1, purchasedAt: today(), notes: '' });

  const load = React.useCallback(async () => {
    try {
      if (id) setItem(await shoppingListService.getItem(id));
      else setAllQuoted(await shoppingListService.listQuotes());
    } catch (error: any) { toast.error(error.message || 'Não foi possível carregar os orçamentos.'); }
    finally { setLoading(false); }
  }, [id]);
  React.useEffect(() => { load(); }, [load]);

  const saveQuote = async (event: React.FormEvent) => {
    event.preventDefault(); if (!item) return;
    try {
      await shoppingListService.addQuote(item.id, { ...quote, unitPrice: Number(quote.unitPrice), quantity: Number(quote.quantity), operatorName: customer?.name || 'Operador' });
      toast.success('Cotação registrada.'); setQuote({ supplierName: '', purchaseLocation: '', unitPrice: '', quantity: item.requested_quantity, quotedAt: today(), notes: '' }); await load();
    } catch (error: any) { toast.error(error.message || 'Não foi possível salvar a cotação.'); }
  };
  const confirmPurchase = async (event: React.FormEvent) => {
    event.preventDefault(); if (!item) return;
    try {
      await shoppingListService.confirmPurchase(item.id, { ...purchase, unitPrice: Number(purchase.unitPrice), quantity: Number(purchase.quantity), operatorName: customer?.name || 'Operador' });
      toast.success('Compra confirmada e registrada.'); await load();
    } catch (error: any) { toast.error(error.message || 'Não foi possível confirmar a compra.'); }
  };
  const print = () => window.print();

  if (!id) return <QuotesOverview items={allQuoted} loading={loading} onPrint={print} />;
  if (loading) return <p className="p-8 text-slate-500">Carregando orçamento…</p>;
  if (!item) return <p className="p-8 text-slate-500">Item não encontrado.</p>;
  const best = getBestQuote(item.quotes);

  return <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
    <Link to="/admin/compras" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={16} /> Voltar à lista</Link>
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:justify-between"><div><p className="text-sm font-semibold text-indigo-600">Orçamento do item</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{item.item_name}</h1><p className="mt-1 font-mono text-sm text-slate-500">{item.sku || 'Sem SKU'} · solicitar {item.requested_quantity} · estoque atual {item.current_stock}</p></div>{best && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3"><p className="text-xs font-bold uppercase text-emerald-700">Menor preço válido</p><p className="mt-1 text-xl font-bold text-emerald-800">{money(best.unit_price)}</p><p className="text-sm text-emerald-700">{best.supplier_name}{best.purchase_location ? ` · ${best.purchase_location}` : ''}</p></div>}</div>
    {item.status !== 'purchased' && item.status !== 'cancelled' && <form onSubmit={saveQuote} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center gap-2"><FileText className="text-indigo-600" size={20} /><h2 className="font-bold">Adicionar cotação</h2></div><div className="grid gap-4 md:grid-cols-3"><Field label="Fornecedor/local" value={quote.supplierName} onChange={(v) => setQuote({ ...quote, supplierName: v })} required /><Field label="Loja/local de compra" value={quote.purchaseLocation} onChange={(v) => setQuote({ ...quote, purchaseLocation: v })} /><Field label="Preço unitário (R$)" type="number" value={quote.unitPrice} onChange={(v) => setQuote({ ...quote, unitPrice: v })} required /><Field label="Quantidade" type="number" value={String(quote.quantity)} onChange={(v) => setQuote({ ...quote, quantity: Number(v) })} required /><Field label="Data" type="date" value={quote.quotedAt} onChange={(v) => setQuote({ ...quote, quotedAt: v })} required /><Field label="Observação" value={quote.notes} onChange={(v) => setQuote({ ...quote, notes: v })} /></div><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Save size={16} /> Salvar cotação</button></form>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Cotações registradas</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Fornecedor/local</th><th className="px-5 py-3 text-right">Preço unit.</th><th className="px-5 py-3 text-right">Qtd.</th><th className="px-5 py-3">Data</th><th className="px-5 py-3">Observação</th></tr></thead><tbody className="divide-y divide-slate-100">{item.quotes?.map((entry) => { const isBest = best?.id === entry.id; return <tr key={entry.id} className={isBest ? 'bg-emerald-50/60' : ''}><td className="px-5 py-3 font-semibold">{entry.supplier_name}{isBest && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Menor preço</span>}<p className="font-normal text-slate-500">{entry.purchase_location || 'Local não informado'}</p></td><td className="px-5 py-3 text-right font-bold">{money(entry.unit_price)}</td><td className="px-5 py-3 text-right">{entry.quantity}</td><td className="px-5 py-3">{new Date(`${entry.quoted_at}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="px-5 py-3 text-slate-600">{entry.notes || '—'}</td></tr>; })}</tbody></table></div></section>
    {item.status === 'quoted' && <form onSubmit={confirmPurchase} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><div className="mb-4 flex items-center gap-2 text-emerald-900"><CheckCircle2 size={20} /><h2 className="font-bold">Confirmar compra efetuada</h2></div><p className="mb-4 text-sm text-emerald-800">Registra fornecedor, quantidade efetiva, preço pago, data e operador; a transição para Comprado é terminal.</p><div className="grid gap-4 md:grid-cols-3"><Field label="Fornecedor" value={purchase.supplierName} onChange={(v) => setPurchase({ ...purchase, supplierName: v })} required /><Field label="Local" value={purchase.purchaseLocation} onChange={(v) => setPurchase({ ...purchase, purchaseLocation: v })} /><Field label="Preço pago unitário (R$)" type="number" value={purchase.unitPrice} onChange={(v) => setPurchase({ ...purchase, unitPrice: v })} required /><Field label="Quantidade comprada" type="number" value={String(purchase.quantity)} onChange={(v) => setPurchase({ ...purchase, quantity: Number(v) })} required /><Field label="Data da compra" type="date" value={purchase.purchasedAt} onChange={(v) => setPurchase({ ...purchase, purchasedAt: v })} required /><Field label="Observação" value={purchase.notes} onChange={(v) => setPurchase({ ...purchase, notes: v })} /></div><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle2 size={16} /> Confirmar compra</button></form>}
  </div>;
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-medium text-slate-700">{label}<input required={required} min={type === 'number' ? '0.01' : undefined} step={type === 'number' ? '0.01' : undefined} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>; }

function QuotesOverview({ items, loading, onPrint }: { items: ShoppingListItem[]; loading: boolean; onPrint: () => void }) {
  const grouped = items.reduce<Record<string, ShoppingListItem[]>>((acc, item) => { const key = bestQuoteFromItem(item)?.supplier_name || 'Sem fornecedor'; (acc[key] ||= []).push(item); return acc; }, {});
  return <div className="space-y-6 animate-in fade-in"><div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1><p className="mt-1 text-sm text-slate-500">Consolidado pelos menores preços válidos, agrupado por fornecedor/local.</p></div><div className="flex gap-2"><Link to="/admin/compras" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Lista principal</Link><button onClick={onPrint} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white"><Printer size={16} /> Imprimir</button></div></div>{loading ? <p className="text-slate-500">Carregando…</p> : Object.entries(grouped).map(([supplier, rows]) => <section key={supplier} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-900">{supplier}</h2></div><div className="divide-y divide-slate-100">{rows.map((item) => { const best = bestQuoteFromItem(item); return <Link key={item.id} to={`/admin/compras/${item.id}/orcamentos`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><div><p className="font-semibold">{item.item_name}</p><p className="font-mono text-xs text-slate-500">{item.sku || 'Sem SKU'} · {best?.purchase_location || 'Local não informado'} · {best?.quoted_at ? new Date(`${best.quoted_at}T12:00:00`).toLocaleDateString('pt-BR') : ''}</p></div><p className="font-bold text-emerald-700">{best ? money(best.unit_price) : '—'}</p></Link>; })}</div></section>)}</div>;
}
