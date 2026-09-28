import { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { productDeadlineRequestsService, type AdminProductDeadlineRequest } from '@/services/productDeadlineRequests';
import type { StorefrontCode } from '@/services/productStorefrontOffers';

const statusLabels: Record<AdminProductDeadlineRequest['status'], string> = {
  new: 'Nova', contacted: 'Cliente contatado', negotiating: 'Em negociação', approved: 'Aprovada', declined: 'Recusada', closed: 'Encerrada',
};
const notificationLabels: Record<AdminProductDeadlineRequest['whatsapp_notification_status'], string> = {
  pending: 'Aviso pendente', sent: 'Aviso enviado', unconfigured: 'WhatsApp aguardando configuração', failed: 'Falha no aviso',
};

export default function ProductDeadlineRequestsPage({ storefront }: { storefront: StorefrontCode }) {
  const [items, setItems] = useState<AdminProductDeadlineRequest[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const is3d = storefront === 'loja_3d';
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    productDeadlineRequestsService.list(storefront, search, page).then(result => {
      if (active) { setItems(result.items); setTotal(result.total); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as solicitações.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storefront, search, page, refresh]);
  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <header><p className={`text-xs font-semibold uppercase tracking-widest ${is3d ? 'text-[var(--print3d-accent)]' : 'text-blue-700'}`}>{is3d ? 'Loja 3D' : 'Mercado do Vale'}</p><h1 className="mt-2 text-2xl font-semibold">Solicitações de prazo</h1><p className="mt-2 text-sm text-slate-600">Analise a quantidade desejada e negocie o prazo antes de criar pedido, cobrança ou reserva.</p></header>
    {is3d && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"><strong>Canal separado:</strong> as solicitações já aparecem aqui. O aviso via WhatsApp ficará como “aguardando configuração” até o número próprio da Loja 3D ser cadastrado.</div>}
    <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(draft.trim()); }} className="flex gap-2"><input maxLength={120} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Protocolo, produto, SKU, cliente ou telefone" className="min-w-0 flex-1 rounded-xl border p-3" /><button className={`rounded-xl px-5 text-white ${is3d ? 'bg-[var(--print3d-accent)]' : 'bg-blue-600'}`}>Buscar</button></form>
    {loading && <p role="status">Carregando solicitações…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {!loading && !items.length && <p className="rounded-xl border bg-white p-6">Nenhuma solicitação encontrada.</p>}
    <div className="grid gap-4">{items.map(item => <RequestCard key={item.id} item={item} onSaved={() => setRefresh(value => value + 1)} />)}</div>
    {!loading && total > 0 && <div className="flex items-center justify-between"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Anterior</button><span className="text-sm">Página {page} de {Math.max(1, Math.ceil(total / 25))} · {total} solicitações</span><button disabled={page * 25 >= total} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Próxima</button></div>}
  </div>;
}

function RequestCard({ item, onSaved }: { item: AdminProductDeadlineRequest; onSaved: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [days, setDays] = useState(item.negotiated_business_days?.toString() || '');
  const [notes, setNotes] = useState(item.admin_notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      await productDeadlineRequestsService.update(item.id, { status, negotiated_business_days: days ? Number(days) : null, admin_notes: notes || null });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.public_code} · {new Date(item.created_at).toLocaleString('pt-BR')}</p><h2 className="mt-1 text-lg font-semibold">{item.product_name_snapshot}</h2><p className="text-sm text-slate-600">SKU {item.sku_snapshot} · <strong>{item.quantity_requested} unidades</strong> · {item.lead_time_label_snapshot}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.whatsapp_notification_status === 'sent' ? 'bg-emerald-100 text-emerald-800' : item.whatsapp_notification_status === 'unconfigured' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-900'}`}>{notificationLabels[item.whatsapp_notification_status]}</span></div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Cliente</p><p className="font-medium">{item.customer_name}</p><p>{item.customer_phone}{item.customer_email ? ` · ${item.customer_email}` : ''}</p>{item.customer_message && <p className="mt-2 rounded-lg bg-slate-50 p-3">{item.customer_message}</p>}</div><div className="grid gap-3"><label>Status<select value={status} onChange={event => setStatus(event.target.value as AdminProductDeadlineRequest['status'])} className="mt-1 w-full rounded-lg border p-2">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prazo negociado em dias úteis<input type="number" min="1" max="3650" value={days} onChange={event => setDays(event.target.value)} placeholder="Preencher após analisar" className="mt-1 w-full rounded-lg border p-2" /></label></div></div>
    <label className="mt-3 block text-sm">Observação interna<textarea rows={2} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar análise'}</button><a href={`https://wa.me/${item.customer_phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800"><MessageCircle size={16} /> Negociar no WhatsApp <ExternalLink size={13} /></a></div>
  </article>;
}
