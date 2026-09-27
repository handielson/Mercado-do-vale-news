import { print3dVariantLabel } from '@/utils/print3dVariantLabel';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPrice } from '@/services/installmentCalculator';
import { print3dCheckoutClient, type PaymentCoverage, type PixCharge, type Print3dOrder } from '@/services/print3dCheckoutClient';
import { readProductionDemo } from '@/services/print3dProductionClient';

const statusLabels: Record<string, string> = { awaiting_payment: 'Aguardando pagamento', pending: 'Aguardando confirmação', approved: 'Pagamento confirmado', paid: 'Pago', partially_paid: 'Entrada confirmada', in_progress: 'Em produção', confirmed: 'Confirmado', ready: 'Pronto', cancelled: 'Cancelado', expired: 'Expirado', refunded: 'Estornado', rejected: 'Recusado', queued: 'Na fila', completed: 'Concluído' };
function OrderCard({ order, demo, onUpdated }: { order: Print3dOrder; demo: boolean; onUpdated: () => void }) {
  const [charges, setCharges] = useState<PixCharge[]>([]); const [coverage, setCoverage] = useState<PaymentCoverage | null>(null);
  const [error, setError] = useState(''); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCharges([]); setCoverage(null); setError('');
    if (demo || order.status === 'cancelled' || ['refunded', 'failed'].includes(order.payment_status)) return;
    let active = true;
    print3dCheckoutClient.payments(order.id).then(result => { if (active) { setCharges(result.charges); setCoverage(result.coverage); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [order.id, order.confirmed_cents, order.status, order.payment_status, demo]);
  async function payment(stage: 'initial' | 'balance', chargeId?: string) {
    if (demo || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setCopied(false);
    try {
      const storageKey = `print3d_pix_attempt_${order.id}_${stage}`;
      const previousCharge = charges.find(value => value.stage === stage);
      if (!chargeId && previousCharge && ['cancelled', 'rejected'].includes(previousCharge.status)) sessionStorage.removeItem(storageKey);
      let key = sessionStorage.getItem(storageKey);
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
      const result = chargeId ? await print3dCheckoutClient.refreshPayment(order.id, chargeId) : await print3dCheckoutClient.pay(order.id, stage, key, email.trim() || undefined);
      setCharges(previous => [result.charge, ...previous.filter(value => value.id !== result.charge.id)]); setCoverage(result.coverage); onUpdated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível consultar o pagamento.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function cancelOrder() {
    if (demo || pending.current || !window.confirm('Cancelar este pedido? Qualquer PIX pendente será encerrado e as peças reservadas voltarão ao estoque.')) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await print3dCheckoutClient.cancel(order.id, 'Cancelamento solicitado pelo cliente antes da confirmação do pagamento.');
      setCharges([]); setCoverage(null); onUpdated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const fullyPaid = coverage?.fully_paid ?? order.outstanding_cents === 0;
  const covered = coverage?.initial_payment_covered ?? order.confirmed_cents >= order.payment_schedule.initial_cents;
  const unavailablePayment = ['refunded', 'failed'].includes(order.payment_status);
  const canCancel = !demo && !unavailablePayment && order.status !== 'cancelled'
    && Number(coverage?.confirmed_cents ?? order.confirmed_cents) === 0;
  const paymentLabel = order.status === 'cancelled' ? 'Pedido cancelado' : unavailablePayment ? 'Pagamento em revisão' : fullyPaid ? 'Pagamento completo' : covered ? 'Entrada confirmada' : 'Aguardando entrada';
  const stage = covered ? 'balance' : 'initial';
  const charge = charges.find(value => value.stage === stage && ['pending', 'creating'].includes(value.status));
  const approved = demo ? readProductionDemo().approved_quantity : null;
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Pedido {order.order_number}</h2><p className="mt-1 text-xs text-stone-500">{new Date(order.created_at).toLocaleDateString('pt-BR')} · {unavailablePayment || order.status === 'cancelled' || order.status === 'awaiting_payment' && covered ? paymentLabel : statusLabels[order.status] || 'Em acompanhamento'}</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs">{paymentLabel}</span></div>
    <div className="my-5 space-y-3">{order.items.map(item => <div key={item.product_id} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {item.product_name}{item.variant_snapshot && Object.keys(item.variant_snapshot).length > 0 && <small className="block text-stone-600">{print3dVariantLabel({ specs: item.variant_snapshot })}</small>}<small className="block text-stone-500">SKU {item.product_sku} · {item.preorder_quantity} sob encomenda</small></span><strong className="whitespace-nowrap">{formatPrice(item.subtotal_cents)}</strong></div>)}</div>
    <dl className="space-y-2 border-t border-stone-200 pt-4 text-sm">{[['Produtos', order.subtotal_cents], ['Frete', order.shipping_cents], ['Total', order.total_cents], ['Confirmado', coverage?.confirmed_cents ?? order.confirmed_cents], ['Saldo a pagar', coverage?.outstanding_cents ?? order.outstanding_cents]].map(([label, amount]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd className="font-medium">{formatPrice(Number(amount))}</dd></div>)}</dl>
    <p className="mt-4 text-xs text-stone-500">Entrada: {formatPrice(order.payment_schedule.initial_cents)}. Antes do envio: {formatPrice(order.payment_schedule.balance_cents)}. {order.shipping_option?.carrier} {order.shipping_option?.name}</p>
    {order.tracking_code && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">Pedido enviado · código de rastreio: {order.tracking_code}</p>}
    {order.payment_schedule.initial_payment_bps != null && <p className="mt-2 text-xs text-stone-500">Condição escolhida: {(order.payment_schedule.initial_payment_bps / 100).toLocaleString('pt-BR')}% de entrada. {order.payment_schedule.shipping_payment_mode === 'full_now' ? 'Frete inteiro na entrada.' : order.payment_schedule.shipping_payment_mode === 'split' ? 'Frete dividido na mesma proporção da entrada.' : 'Frete no saldo antes do envio.'}</p>}
    {order.items.some(item => item.preorder_quantity > 0) && <div className="mt-5 rounded-xl bg-stone-50 p-4 text-sm">{demo && <p className="mb-2 font-medium">{approved} de 100 unidades aprovadas · {100 - (approved || 0)} pendentes</p>}<Link className="underline" to={'/loja-3d/conta/producao' + (demo ? '?demo=1' : '')}>Acompanhar produção e lotes aprovados →</Link></div>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {unavailablePayment && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">O pagamento está em revisão{order.payment_status === 'refunded' ? ' após estorno' : ''}. Aguarde o atendimento da loja 3D antes de tentar um novo pagamento. Os valores acima registram o histórico do pedido.</p>}
    {!fullyPaid && !unavailablePayment && order.status !== 'cancelled' && <div className="mt-5 border-t border-stone-200 pt-5">
      <h3 className="font-semibold">{covered ? 'Pagamento do saldo' : 'Pagamento da entrada'}</h3>
      {covered && <p className="mt-2 text-xs text-stone-500">O saldo fica disponível para cobrança quando toda a produção estiver concluída.</p>}
      {demo ? <p className="mt-3 text-sm text-amber-800">Demonstração: não é gerado PIX nem movimentado dinheiro.</p> : <>
        {!charge && <form onSubmit={event => { event.preventDefault(); void payment(stage); }}><label className="mt-3 block text-sm">E-mail para o pagamento (se não cadastrado)<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2" /></label><button disabled={busy} className="mt-3 rounded-lg bg-stone-900 px-5 py-3 text-sm text-white disabled:opacity-40">{busy ? 'Consultando…' : 'Gerar PIX'}</button></form>}
        {charge && <div className="mt-4 rounded-xl bg-stone-50 p-4"><p className="text-sm font-medium">PIX de {formatPrice(charge.amount_cents)}</p>{charge.expires_at && <p className="mt-1 text-xs text-stone-500">Válido até {new Date(charge.expires_at).toLocaleString('pt-BR')}</p>}{charge.pix_qr_base64 && /^[A-Za-z0-9+/=\s]+$/.test(charge.pix_qr_base64) && <img className="mx-auto my-4 w-48 max-w-full" alt="QR Code PIX do pedido" src={'data:image/png;base64,' + charge.pix_qr_base64} />}{charge.pix_code && <><label className="mt-3 block text-xs">PIX copia e cola<textarea readOnly value={charge.pix_code} className="mt-1 block w-full resize-none break-all rounded-lg border border-stone-300 bg-white p-2" /></label><button onClick={() => { void navigator.clipboard.writeText(charge.pix_code || '').then(() => setCopied(true)).catch(() => setError('Selecione e copie o código acima.')); }} className="mt-2 text-sm underline">{copied ? 'Código copiado' : 'Copiar código'}</button></>}<button disabled={busy} onClick={() => void payment(stage, charge.id)} className="mt-4 block w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm disabled:opacity-40">{busy ? 'Consultando…' : 'Já paguei: verificar confirmação'}</button><p className="mt-2 text-xs text-stone-500">O pagamento só é confirmado após consulta ao provedor.</p></div>}
      </>}
    </div>}
    {canCancel && <div className="mt-4 border-t border-stone-200 pt-4"><button type="button" disabled={busy} onClick={() => void cancelOrder()} className="text-sm font-medium text-red-700 underline disabled:opacity-40">{busy ? 'Processando…' : 'Cancelar pedido antes do pagamento'}</button><p className="mt-1 text-xs text-stone-500">Após a confirmação da entrada, qualquer cancelamento é analisado pela equipe.</p></div>}
  </article>;
}
function demoOrder(): Print3dOrder { return { id: 'demo-order', order_number: '3D-DEMO-100', status: 'in_progress', payment_status: 'partially_paid', created_at: new Date().toISOString(), subtotal_cents: 190000, shipping_cents: 2500, total_cents: 192500, confirmed_cents: 95000, outstanding_cents: 97500, shipping_address: { cep: '00000000', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }, shipping_option: { carrier: 'Transportadora ilustrativa', name: 'Entrega padrão' }, items: [{ product_id: 'demo-product', product_name: 'Chaveiro personalizado', product_sku: 'DEMO-CHAVEIRO', quantity: 100, unit_price_cents: 1900, subtotal_cents: 190000, ready_quantity: 0, preorder_quantity: 100, production_days: 5 }], payment_schedule: { initial_cents: 95000, balance_cents: 97500, due_on_confirmation_cents: 95000, due_before_shipping_cents: 95000, shipping_cents: 2500 } }; }
export default function Print3dOrdersPage() {
  const [params] = useSearchParams(); const demo = params.get('demo') === '1';
  const [orders, setOrders] = useState<Print3dOrder[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setBusy(true); const operation = demo ? Promise.resolve({ orders: [demoOrder()] }) : print3dCheckoutClient.orders(); operation.then(result => { if (active) { setOrders(result.orders); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [demo, revision]);
  return <main className="min-h-screen bg-[var(--print3d-surface)] px-4 py-8 text-stone-800"><div className="mx-auto max-w-3xl"><Link className="text-sm text-stone-600" to={'/loja-3d/conta' + (demo ? '?demo=1' : '')}>← Minha conta 3D</Link><div className="my-7 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold tracking-tight">Meus pedidos</h1><button disabled={busy} onClick={() => setRevision(value => value + 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Atualizando…' : 'Atualizar'}</button></div>{demo && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Simulação local: entrada de 50% confirmada e 20 de 100 unidades produzidas. Nenhum dado ou pagamento real.</p>}{error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} <Link className="underline" to="/loja-3d/conta">Entrar na conta 3D</Link></p>}<div className="space-y-5">{orders.map(order => <OrderCard key={order.id} order={order} demo={demo} onUpdated={() => setRevision(value => value + 1)} />)}</div>{!busy && !error && !orders.length && <p className="rounded-xl bg-white p-6 text-sm">Você ainda não tem pedidos. <Link className="underline" to="/loja-3d">Visitar loja</Link></p>}</div></main>;
}
