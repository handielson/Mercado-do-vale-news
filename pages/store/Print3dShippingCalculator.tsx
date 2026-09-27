import { useEffect, useRef, useState } from 'react';
import { vpsClient } from '@/services/vpsClient';
import { formatPrice } from '@/services/installmentCalculator';

type ShippingQuote = {
  subtotal_cents: number; production_days: number; handling_business_days: number; notice: string;
  options: Array<{ id: string; carrier: string; name: string; price_cents: number; transport_business_days: number }>;
};

export default function Print3dShippingCalculator({ items, preview = false }: {
  items: Array<{ product_id: string; quantity: number }>; preview?: boolean;
}) {
  const [cep, setCep] = useState('');
  const [result, setResult] = useState<ShippingQuote | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const identity = JSON.stringify(items);
  useEffect(() => {
    version.current++;
    setResult(null); setSelected(''); setError(''); setBusy(false);
    return () => { version.current++; };
  }, [identity, cep, preview]);
  async function calculate() {
    if (cep.length !== 8 || /^0+$/.test(cep)) { setError('Informe um CEP válido com 8 dígitos.'); return; }
    if (preview) { setError('A cotação real estará disponível com produtos e transportadoras configurados.'); return; }
    const request = ++version.current;
    setBusy(true); setError(''); setResult(null); setSelected('');
    try {
      const quote = await vpsClient.post<ShippingQuote>('/storefronts/loja_3d/shipping/quote', { cep, items });
      if (request === version.current) setResult(quote);
    } catch (cause) {
      if (request === version.current) {
        const match = cause instanceof Error ? cause.message.match(/"error"\s*:\s*"([^"]+)"/) : null;
        setError(match?.[1] || 'Não foi possível calcular o frete agora. Tente novamente ou entre em contato.');
      }
    } finally { if (request === version.current) setBusy(false); }
  }
  const option = result?.options.find(item => item.id === selected);
  return <section aria-label="Calcular frete" className="mt-6 border-t border-[#deded8] pt-5 text-sm">
    <label className="block font-semibold">Calcule a entrega
      <span className="mt-3 flex gap-2"><input aria-label="CEP de entrega" autoComplete="postal-code" inputMode="numeric" placeholder="Seu CEP" value={cep.length > 5 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep} onChange={event => { version.current++; setResult(null); setBusy(false); setCep(event.target.value.replace(/\D/g, '').slice(0, 8)); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void calculate(); } }} className="min-w-0 flex-1 rounded-md border border-[#cbd0c9] bg-white px-3 py-2 font-normal" /><button type="button" disabled={busy || items.length === 0} onClick={() => void calculate()} className="rounded-md bg-[var(--print3d-accent)] px-4 py-2 text-white disabled:opacity-50">{busy ? 'Calculando…' : 'Calcular'}</button></span>
    </label>
    {preview && <p className="mt-2 text-xs text-[#69716c]">Prévia visual: nenhum frete real será consultado.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {result && <div className="mt-4 space-y-2" aria-live="polite">
      {result.options.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-[#deded8] p-3"><input type="radio" name={'shipping-' + identity} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span className="flex-1"><span className="block">{item.carrier} · {item.name}</span><span className="text-xs text-[#69716c]">{item.transport_business_days} dias úteis de transporte após postagem</span></span><strong className="whitespace-nowrap">{formatPrice(item.price_cents)}</strong></label>)}
      {result.production_days > 0 && <p className="text-xs">Produção da encomenda: {result.production_days} dias, antes do envio.</p>}
      <p className="text-xs">Preparação para postagem: {result.handling_business_days} dias úteis.</p>
      {option && <div className="flex justify-between border-t border-[#deded8] pt-3 font-semibold"><span>Produtos + frete estimado</span><span>{formatPrice(result.subtotal_cents + option.price_cents)}</span></div>}
      <p className="text-xs leading-relaxed text-[#69716c]">{result.notice}</p>
    </div>}
  </section>;
}
