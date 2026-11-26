// stock-write-off-v1: baixa administrativa de estoque — avaria (descarte), uso na loja, brinde, perda.
// A saída é lançada no Bling com o tipo, o motivo e quem deu a baixa nas observações.
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, PackageMinus, ScanLine, Trash2 } from 'lucide-react';
import { vpsClient } from '@/services/vpsClient';
import { vpsApiService } from '@/services/vpsApiService';
import { getUnitTimeline, isTimelineMatches } from '@/services/unitTimelineService';

type Kind = { value: string; label: string };
type Picked = { productId: string; name: string; sku?: string | null; stock?: number | null; unitId?: string; imei?: string | null };
type WriteOff = { id: string; created_at: string; product_name: string; sku: string | null; quantity: number; kind_label: string;
  reason: string; responsible: string; imei: string | null; location_name: string | null };

const RESPONSIBLE_KEY = 'mdv-write-off-responsible';
const errorText = (err: unknown) => {
  const text = err instanceof Error ? err.message : String(err);
  const detail = text.split(' — ').slice(1).join(' — ');
  try { return JSON.parse(detail).error || detail || text; } catch { return detail || text; }
};
const readResponsible = () => { try { return localStorage.getItem(RESPONSIBLE_KEY) || ''; } catch { return ''; } };
const saveResponsible = (v: string) => { try { localStorage.setItem(RESPONSIBLE_KEY, v); } catch { /* sem armazenamento */ } };
const looksLikeImei = (v: string) => /^\d{14,16}$/.test(v.replace(/\s/g, ''));

export default function StockWriteOffsPage() {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [history, setHistory] = useState<WriteOff[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Picked[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [kind, setKind] = useState('avaria');
  const [reason, setReason] = useState('');
  const [responsible, setResponsible] = useState(readResponsible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadHistory = () => vpsClient.get<WriteOff[]>('/stock-write-offs?limit=100').then(setHistory).catch(() => {});
  useEffect(() => {
    vpsClient.get<Kind[]>('/stock-write-offs/kinds').then(setKinds).catch(() => setError('Não foi possível carregar os tipos de baixa.'));
    loadHistory();
  }, []);

  const find = async (e: FormEvent) => {
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    setSearching(true); setError(''); setResults([]);
    try {
      if (looksLikeImei(term)) {
        const data = await getUnitTimeline(term.replace(/\s/g, ''));
        if (isTimelineMatches(data)) { setError('Mais de um aparelho com esse número. Use o outro IMEI ou o serial.'); return; }
        if (data.current.status !== 'available') { setError(`Este aparelho está ${data.current.statusLabel.toLowerCase()}: só dá para baixar aparelho disponível.`); return; }
        setPicked({ productId: data.unit.product_id, name: data.product?.name || 'Aparelho', sku: data.product?.sku, unitId: data.unit.id, imei: data.unit.imei_1 || data.unit.imei || term });
        setQuantity('1');
        return;
      }
      const list = await vpsApiService.getProducts({ search: term, compact: true, limit: 15, status: 'all' }) || [];
      setResults(list.map((p: any) => ({ productId: p.id, name: p.name, sku: p.sku, stock: p.stock_quantity })));
      if (!list.length) setError('Nenhum produto encontrado.');
    } catch (err) {
      setError(/\b404\b/.test(String(err)) ? 'IMEI ou serial não encontrado.' : errorText(err));
    } finally { setSearching(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await vpsClient.post<any>('/stock-write-offs', {
        product_id: picked.productId, unit_id: picked.unitId, quantity: picked.unitId ? 1 : Number(quantity),
        kind, reason, responsible,
      });
      saveResponsible(responsible.trim());
      setNotice(`Baixa feita: ${r.quantity}x ${r.product_name} (${r.kind_label}). No Bling: "${r.bling_notes}".`);
      setPicked(null); setResults([]); setSearch(''); setReason(''); setQuantity('1');
      loadHistory();
    } catch (err) { setError(errorText(err)); } finally { setSaving(false); }
  };

  const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
  return <div className="mx-auto max-w-4xl space-y-4 p-4">
    <div className="flex items-center gap-2"><PackageMinus className="h-5 w-5 text-slate-600" /><h1 className="text-lg font-semibold">Baixa de estoque</h1></div>
    <p className="text-sm text-slate-600">Para avaria (vai para o lixo), retirada para uso na loja, brinde ou perda. A saída é lançada no Bling com o motivo e quem deu a baixa.</p>

    <form onSubmit={find} className="flex gap-2">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, SKU ou IMEI do aparelho" className={input} autoFocus />
      <button className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white" disabled={searching}>
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}Buscar</button>
    </form>

    {!picked && results.length > 0 && <div className="divide-y rounded-xl border bg-white">
      {results.map(p => <button key={p.productId} type="button" onClick={() => { setPicked(p); setResults([]); }}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
        <span>{p.name}{p.sku ? <span className="ml-2 text-xs text-slate-500">{p.sku}</span> : null}</span>
        <span className="text-xs text-slate-500">estoque {p.stock ?? '—'}</span></button>)}
    </div>}

    {picked && <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">{picked.name}</p>
          <p className="text-xs text-slate-500">{[picked.sku, picked.imei ? `IMEI ${picked.imei}` : '', picked.stock != null ? `estoque ${picked.stock}` : ''].filter(Boolean).join(' · ')}</p></div>
        <button type="button" onClick={() => setPicked(null)} className="text-xs text-slate-500 underline">trocar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="text-sm font-semibold text-slate-700">Tipo da baixa</span>
          <select value={kind} onChange={e => setKind(e.target.value)} className={`mt-1 ${input}`}>
            {kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
        <label className="block"><span className="text-sm font-semibold text-slate-700">Quantidade</span>
          <input type="number" min="1" step="1" value={picked.unitId ? '1' : quantity} disabled={!!picked.unitId}
            onChange={e => setQuantity(e.target.value)} className={`mt-1 ${input}`} required /></label>
        <label className="block"><span className="text-sm font-semibold text-slate-700">Quem deu a baixa</span>
          <input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Seu nome" className={`mt-1 ${input}`} required /></label>
      </div>
      <label className="block"><span className="text-sm font-semibold text-slate-700">Motivo (vai para o Bling)</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={300} required
          placeholder="Ex.: tela trincada identificada na venda; carregador para o balcão"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <button disabled={saving || !reason.trim() || !responsible.trim()} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Dar baixa</button>
    </form>}

    {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

    <div className="rounded-xl border bg-white">
      <p className="border-b px-3 py-2 text-sm font-semibold">Últimas baixas</p>
      {history.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500">Nenhuma baixa ainda.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
            <th className="px-3 py-2">Data</th><th className="px-3 py-2">Produto</th><th className="px-3 py-2">Qtd</th>
            <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Quem</th></tr></thead>
          <tbody className="divide-y">{history.map(w => <tr key={w.id}>
            <td className="whitespace-nowrap px-3 py-2 text-xs">{new Date(w.created_at).toLocaleString('pt-BR')}</td>
            <td className="px-3 py-2">{w.product_name}<div className="text-xs text-slate-500">{[w.sku, w.imei && `IMEI ${w.imei}`, w.location_name].filter(Boolean).join(' · ')}</div></td>
            <td className="px-3 py-2">{w.quantity}</td><td className="px-3 py-2">{w.kind_label}</td>
            <td className="px-3 py-2">{w.reason}</td><td className="px-3 py-2">{w.responsible}</td></tr>)}</tbody>
        </table></div>}
    </div>
  </div>;
}
