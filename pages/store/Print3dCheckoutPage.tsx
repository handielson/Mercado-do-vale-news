import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatPrice } from '@/services/installmentCalculator';
import { print3dAccountClient } from '@/services/print3dAccountClient';
import { productStorefrontOffersService, type Print3dQuote } from '@/services/productStorefrontOffers';
import { checkoutAttempt, clearCheckoutCart, paymentTermsPreview, percentageToBps, print3dCheckoutClient, readCheckoutCart, type PaymentTerms, type ShippingAddress, type ShippingQuote } from '@/services/print3dCheckoutClient';

const emptyAddress: ShippingAddress = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
export default function Print3dCheckoutPage() {
  const [params] = useSearchParams(); const demo = params.get('demo') === '1'; const navigate = useNavigate();
  const [items] = useState(readCheckoutCart);
  const [enabled, setEnabled] = useState(false); const [loading, setLoading] = useState(!demo);
  const [authenticated, setAuthenticated] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress);
  const [quote, setQuote] = useState<Print3dQuote | null>(null);
  const [shipping, setShipping] = useState<ShippingQuote | null>(null); const [selected, setSelected] = useState('');
  const [percentage, setPercentage] = useState('50');
  const [shippingMode, setShippingMode] = useState<PaymentTerms['shipping_payment_mode']>('later');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false); const version = useRef(0);
  useEffect(() => {
    if (demo) return;
    let active = true;
    Promise.all([print3dCheckoutClient.config(), print3dAccountClient.me()]).then(([config, customer]) => { if (active) { setEnabled(config.enabled); setAuthenticated(Boolean(customer)); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; version.current++; };
  }, [demo]);
  const option = shipping?.options.find(value => value.id === selected);
  const bps = percentageToBps(percentage);
  const payments = bps !== null && quote?.subtotal != null && option ? paymentTermsPreview(quote.subtotal, option.price_cents, { initial_payment_bps: bps, shipping_payment_mode: shippingMode }) : null;
  async function calculate() {
    if (demo) { navigate('/loja-3d/pedidos?demo=1'); return; }
    const requestVersion = ++version.current; setBusy(true); setError(''); setShipping(null); setSelected(''); setQuote(null);
    try {
      const [prices, delivery] = await Promise.all([productStorefrontOffersService.quotePrint3d(items), print3dCheckoutClient.shipping(address.cep, items)]);
      if (requestVersion !== version.current) return;
      if (!prices.payment_schedule || prices.items.some(item => item.status !== 'available')) throw new Error('Há itens indisponíveis. Revise seu carrinho.');
      if (prices.subtotal !== delivery.subtotal_cents) throw new Error('Os preços foram atualizados. Calcule novamente antes de continuar.');
      setQuote(prices); setShipping(delivery);
    } catch (err) { if (requestVersion === version.current) setError(err instanceof Error ? err.message : 'Não foi possível conferir a entrega.'); }
    finally { if (requestVersion === version.current) setBusy(false); }
  }
  async function confirm() {
    if (pending.current || !enabled || !authenticated || !option || !shipping?.quote_token || demo || bps === null) return;
    pending.current = true; setBusy(true); setError('');
    const intent = { items, shipping_address: address, shipping_option_id: option.id, payment_terms: { initial_payment_bps: bps, shipping_payment_mode: shippingMode } };
    try {
      await print3dCheckoutClient.create({ ...intent, quote_token: shipping.quote_token, idempotency_key: checkoutAttempt(intent) });
      clearCheckoutCart(); navigate('/loja-3d/pedidos');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível confirmar. Tente novamente para recuperar a mesma solicitação.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f7f7f2] px-4 py-8 text-stone-800"><div className="mx-auto max-w-3xl">
    <Link to={'/loja-3d' + (demo ? '?demo=1' : '')} className="text-sm text-stone-600">← Continuar comprando</Link>
    <h1 className="my-6 text-3xl font-semibold tracking-tight">Finalizar pedido</h1>
    {demo && <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Simulação local, sem pedido ou cobrança real. <Link className="underline" to="/loja-3d/pedidos?demo=1">Ver exemplo: 100 unidades, 20 produzidas.</Link></div>}
    {!demo && (!enabled || !authenticated) && <p className="mb-5 rounded-xl bg-stone-100 p-4 text-sm">{loading ? 'Conferindo disponibilidade…' : !authenticated ? 'Entre na sua conta 3D para continuar. Seu carrinho fica salvo neste navegador.' : 'A finalização ainda não está liberada.'} <Link className="underline" to="/loja-3d/conta">Minha conta</Link></p>}
    {!demo && !items.length && <p className="mb-5">Seu carrinho está vazio. Adicione produtos na loja para continuar.</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void calculate(); }} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Endereço de entrega</h2><p className="mt-2 text-sm text-stone-500">Confira seu endereço antes de consultar as transportadoras.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{([
        ['cep', 'CEP', 'postal-code'], ['street', 'Rua / avenida', 'address-line1'], ['number', 'Número ou S/N', 'off'], ['complement', 'Complemento (opcional)', 'address-line2'], ['neighborhood', 'Bairro', 'off'], ['city', 'Cidade', 'address-level2'], ['state', 'Estado (UF)', 'address-level1'],
      ] as const).map(([key, label, autocomplete]) => <label key={key} className="text-sm">{label}<input required={key !== 'complement'} autoComplete={autocomplete} maxLength={key === 'state' ? 2 : key === 'cep' ? 8 : 160} pattern={key === 'cep' ? '[0-9]{8}' : key === 'state' ? '[A-Za-z]{2}' : undefined} inputMode={key === 'cep' ? 'numeric' : undefined} value={address[key]} onChange={event => { version.current++; setBusy(false); setShipping(null); setQuote(null); setSelected(''); setAddress(previous => ({ ...previous, [key]: key === 'cep' ? event.target.value.replace(/\D/g, '') : key === 'state' ? event.target.value.toUpperCase() : event.target.value })); }} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2" /></label>)}</div>
      <button disabled={busy || (!demo && (!enabled || !authenticated || !items.length))} className="mt-5 rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40">{busy ? 'Conferindo…' : demo ? 'Ver pedido de demonstração' : 'Conferir produtos e entrega'}</button>
    </form>
    {shipping && quote && <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Entrega e valores</h2>
      <div className="my-5 space-y-3">{quote.items.map(item => <div className="flex justify-between gap-3 text-sm" key={item.product_id}><span>{item.quantity} × {item.name || item.sku}<small className="block text-stone-500">{item.ready_quantity || 0} prontas · {item.preorder_quantity || 0} sob encomenda</small></span><span>{formatPrice(item.subtotal || 0)}</span></div>)}</div>
      {shipping.options.map(value => <label key={value.id} className="mt-3 flex gap-3 rounded-lg border border-stone-200 p-3 text-sm"><input type="radio" name="delivery" checked={selected === value.id} onChange={() => setSelected(value.id)} /><span className="flex-1">{value.carrier} · {value.name}<small className="block text-stone-500">{value.transport_business_days} dias úteis após postagem</small></span><strong>{formatPrice(value.price_cents)}</strong></label>)}
      <p className="mt-4 text-xs text-stone-600">{shipping.production_days > 0 && `Produção: ${shipping.production_days} dias. `}Preparação: {shipping.handling_business_days} dias úteis, além do transporte. O pedido será enviado junto.</p>
      {option && <div className="mt-5 space-y-4 border-t border-stone-200 pt-5 text-sm">
        <h3 className="text-lg font-semibold">Como deseja pagar?</h3>
        <label className="block">Percentual de entrada nos produtos
          <span className="mt-2 flex items-center gap-2"><input aria-label="Percentual de entrada nos produtos" inputMode="decimal" value={percentage} onChange={event => setPercentage(event.target.value)} disabled={busy} className="w-28 rounded-lg border border-stone-300 px-3 py-2" /><span>%</span></span>
          <span className="mt-2 block text-xs text-stone-500">De 50% a 100%, para peças prontas e sob encomenda.</span>
        </label>
        {bps === null && <p role="alert" className="text-red-700">Informe de 50% a 100%, com até duas casas decimais.</p>}
        <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 font-medium">Quando pagar o frete?</legend>{([
          ['later', 'Frete no saldo', 'Pagar o frete inteiro antes do envio.'],
          ['full_now', 'Frete inteiro agora', 'Somar o frete completo à entrada dos produtos.'],
          ['split', 'Dividir o frete', 'Aplicar o percentual escolhido aos produtos e ao frete.'],
        ] as const).map(([mode, label, description]) => <label key={mode} className="flex cursor-pointer gap-3 rounded-lg border border-stone-200 p-3"><input type="radio" name="freight-payment" checked={shippingMode === mode} onChange={() => setShippingMode(mode)} /><span>{label}<small className="block text-stone-500">{description}</small></span></label>)}</fieldset>
        <div className="flex justify-between"><span>Total com frete</span><strong>{formatPrice((quote.subtotal || 0) + option.price_cents)}</strong></div>
        {payments && <div aria-live="polite" className="space-y-2 rounded-xl bg-stone-50 p-4">
          <div className="flex justify-between gap-3"><span>Produtos na entrada</span><span>{formatPrice(payments.products_initial_cents)}</span></div>
          <div className="flex justify-between gap-3"><span>Frete na entrada</span><span>{formatPrice(payments.shipping_initial_cents)}</span></div>
          <div className="flex justify-between gap-3 font-semibold"><span>Pagar agora</span><span data-testid="initial-payment">{formatPrice(payments.initial_cents)}</span></div>
          <div className="flex justify-between gap-3 font-semibold"><span>Antes do envio</span><span data-testid="balance-payment">{formatPrice(payments.balance_cents)}</span></div>
          {payments.balance_cents === 0 && <p className="text-xs text-stone-500">Pagamento integral escolhido. Não haverá saldo antes do envio.</p>}
        </div>}
        <p className="text-xs text-stone-500">A produção começa após a confirmação da entrada escolhida. O envio exige pagamento completo. Para encomendar, seu WhatsApp precisa estar validado na conta 3D.</p>
        <button onClick={() => void confirm()} disabled={busy || !enabled || !authenticated || !shipping.quote_token || !payments} className="w-full rounded-lg bg-stone-900 py-3 font-medium text-white disabled:opacity-40">{busy ? 'Confirmando…' : 'Criar pedido e continuar para pagamento'}</button>
      </div>}
    </section>}
  </div></main>;
}
