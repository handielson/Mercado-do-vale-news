import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelPrint3dAdminOrder, dispatchPrint3dAdminOrder, listPrint3dAdmin, type Print3dAdminList, type Print3dAdminOrder, type Print3dCustomer } from '@/services/print3dAdminClient';
import { formatCurrency } from '@/utils/saleCalculations';

const statusLabels: Record<string, string> = { pending: 'Pendente', awaiting_payment: 'Aguardando pagamento', paid: 'Pago', confirmed: 'Confirmado', preparing: 'Em preparo', shipped: 'Enviado', delivered: 'Entregue', completed: 'Concluído', cancelled: 'Cancelado', refunded: 'Estornado', partially_paid: 'Pago parcialmente', payment_failed: 'Pagamento não concluído' };
const dateLabel = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR'); };
type Records = Print3dAdminList<Print3dCustomer | Print3dAdminOrder>;

export default function Print3dRecordsPage({ kind }: { kind: 'customers' | 'orders' }) {
  const customers = kind === 'customers';
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Records | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setResult(null);
    void listPrint3dAdmin(kind, search, page).then(data => {
      if (data.storefront !== 'loja_3d') throw new Error('A resposta não pertence à loja 3D.');
      if (active) setResult(data);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os registros.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [kind, search, page, refresh]);
  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--print3d-accent)]">Loja 3D</p><h1 className="mt-2 text-2xl font-semibold">{customers ? 'Clientes 3D' : 'Pedidos 3D'}</h1><p className="mt-2 text-sm text-slate-600">{customers ? 'Contas independentes da loja 3D, com verificação de e-mail e WhatsApp.' : 'Encomendas da loja 3D, com entrada, pagamentos confirmados e saldo.'}</p></div><button disabled={busy} onClick={() => setRefresh(n => n + 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-50">Atualizar</button></header>
    <nav aria-label="Áreas da loja 3D" className="flex flex-wrap gap-4 text-sm text-[var(--print3d-accent)]"><Link to="/admin/loja-3d/clientes">Clientes 3D</Link><Link to="/admin/loja-3d/pedidos">Pedidos 3D</Link><Link to="/admin/loja-3d/producao">Produção 3D</Link><Link to="/admin/loja-3d/catalogo">Catálogo e preços 3D</Link></nav>
    <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(draft.trim()); setRefresh(n => n + 1); }} className="flex gap-2"><label className="flex-1"><span className="sr-only">Buscar {customers ? 'clientes' : 'pedidos'} 3D</span><input maxLength={120} value={draft} onChange={event => setDraft(event.target.value)} placeholder={customers ? 'Nome, e-mail ou telefone' : 'Número do pedido, nome, e-mail ou telefone'} className="w-full rounded-xl border p-3" /></label><button disabled={busy} className="rounded-xl bg-[var(--print3d-accent)] px-5 py-2 text-white disabled:opacity-50">Buscar</button></form>
    {busy && <p role="status">Carregando {customers ? 'clientes' : 'pedidos'} 3D…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {!busy && result && !result.enabled && <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">{customers ? 'Cadastro de clientes 3D ainda não habilitado' : 'Pedidos reais 3D ainda não habilitados'}</h2><p className="mt-2 text-sm">Esta área está preparada para os registros exclusivos da loja 3D. A ativação será feita após concluir a configuração e os testes.</p></section>}
    {!busy && result?.enabled && <>
      <p className="text-sm text-slate-600">{result.total} {customers ? 'cliente(s)' : 'pedido(s)'} da loja 3D</p>
      {!result.items.length ? <p className="rounded-xl border bg-white p-6">{search ? 'Nenhum resultado para esta busca.' : customers ? 'Nenhum cliente 3D cadastrado.' : 'Nenhum pedido 3D recebido.'}</p> : <div className="grid gap-4 md:grid-cols-2">{result.items.map(record => customers ? <CustomerCard key={record.id} customer={record as Print3dCustomer} /> : <OrderCard key={record.id} order={record as Print3dAdminOrder} dispatchEnabled={result.dispatch_enabled} onUpdated={() => setRefresh(n => n + 1)} />)}</div>}
      <div className="flex items-center justify-between gap-3"><button disabled={page === 1} onClick={() => setPage(n => n - 1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Anterior</button><span className="text-sm">Página {result.page} de {Math.max(1, Math.ceil(result.total / result.page_size))}</span><button disabled={page * result.page_size >= result.total} onClick={() => setPage(n => n + 1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Próxima</button></div>
    </>}
  </div>;
}

function CustomerCard({ customer }: { customer: Print3dCustomer }) {
  return <article className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{customer.name}</h2><p className="mt-1 text-sm text-slate-600">{customer.is_active ? 'Conta ativa' : 'Conta inativa'} · Cadastro em {dateLabel(customer.created_at)}</p><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">E-mail</dt><dd className="break-all">{customer.email || 'Não informado'} · {customer.email_verified_at ? 'Validado' : 'Não validado'}</dd></div><div><dt className="text-slate-500">WhatsApp</dt><dd>{customer.phone || 'Não informado'} · {customer.phone_verified_at ? 'Validado' : 'Não validado'}</dd></div></dl></article>;
}
function OrderCard({ order, dispatchEnabled, onUpdated }: { order: Print3dAdminOrder; dispatchEnabled:boolean; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [tracking, setTracking] = useState('');
  const canCancel = order.status !== 'cancelled' && order.confirmed_cents === 0 && !['paid','approved','refunded'].includes(order.payment_status);
  async function cancel() {
    if (busy || !window.confirm('Cancelar este pedido 3D? As reservas não pagas serão liberadas.')) return;
    setBusy(true); setError('');
    try { await cancelPrint3dAdminOrder(order.id, 'Cancelamento administrativo antes da confirmação do pagamento.'); onUpdated(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar o pedido.'); }
    finally { setBusy(false); }
  }
  async function dispatch(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !window.confirm('Confirmar a entrega à transportadora? Esta ação dá baixa definitiva nas peças reservadas e registra o pedido como enviado.')) return;
    setBusy(true); setError('');
    try { await dispatchPrint3dAdminOrder(order.id,tracking.trim()); onUpdated(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a expedição.'); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Pedido {order.order_number || order.id.slice(0, 8)}</h2><span className="text-sm text-slate-600">{dateLabel(order.created_at)}</span></div><p className="mt-2 text-sm">{order.customer.name || 'Cliente 3D indisponível'} · {statusLabels[order.status] || order.status}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Total com frete</dt><dd>{formatCurrency(order.total_cents)}</dd></div><div><dt className="text-slate-500">Frete</dt><dd>{formatCurrency(order.shipping_cents)}</dd></div><div><dt className="text-slate-500">Pagamento confirmado</dt><dd>{formatCurrency(order.confirmed_cents)}</dd></div><div><dt className="text-slate-500">Saldo do pedido</dt><dd>{formatCurrency(order.outstanding_cents)}</dd></div>{order.payment_schedule && <div className="col-span-2"><dt className="text-slate-500">Entrada combinada</dt><dd>{formatCurrency(order.payment_schedule.due_on_confirmation_cents)}</dd></div>}</dl><p className="mt-3 text-xs text-slate-500">Pagamento: {statusLabels[order.payment_status] || order.payment_status}. Valores confirmados conforme os registros de pagamento.</p>{order.payment_review?.pending_cancellations > 0 && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">PIX aguardando conferência: {order.payment_review.pending_cancellations} cobrança(s). O pedido está cancelado, mas o encerramento no provedor ainda não foi confirmado.</p>}{order.payment_review?.late_payments > 0 && <p role="status" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Pagamento após cancelamento: {formatCurrency(order.payment_review.late_amount_cents)} em {order.payment_review.late_payments} cobrança(s). Conferir no provedor e analisar estorno. O pedido permanece cancelado; este valor não libera produção ou envio.</p>}{order.payment_review?.refunded_payments > 0 && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Estorno integral confirmado pelo provedor: {order.payment_review.refunded_payments} cobrança(s). O pedido permanece cancelado.</p>}{order.tracking_code && <p className="mt-2 text-sm font-medium">Rastreio: {order.tracking_code}</p>}{canCancel && <div className="mt-4 border-t pt-4"><button type="button" disabled={busy} onClick={() => void cancel()} className="text-sm font-medium text-red-700 underline disabled:opacity-50">{busy ? 'Cancelando…' : 'Cancelar e liberar reservas'}</button><p className="mt-1 text-xs text-slate-500">Pedidos com entrada confirmada exigem análise de estorno.</p></div>}{dispatchEnabled && !order.tracking_code && order.status !== 'cancelled' && <form onSubmit={event => void dispatch(event)} className="mt-4 space-y-2 border-t pt-4"><label className="block text-sm font-medium">Código de rastreio<input required minLength={3} maxLength={120} pattern="[A-Za-z0-9][A-Za-z0-9._/-]{2,119}" value={tracking} onChange={event => setTracking(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><button type="submit" disabled={busy || order.outstanding_cents > 0} className="rounded-lg bg-[var(--print3d-accent)] px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Registrar expedição'}</button><p className="text-xs text-slate-500">Exige pagamento integral e todas as peças prontas. Confirme o envio físico antes de registrar.</p></form>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</article>;
}
