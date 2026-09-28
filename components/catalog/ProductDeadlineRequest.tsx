import { useState } from 'react';
import { Clock3, MessageCircle } from 'lucide-react';
import { productDeadlineRequestsService } from '@/services/productDeadlineRequests';
import type { StorefrontCode } from '@/services/productStorefrontOffers';

type Props = {
  storefront: StorefrontCode;
  product: { id: string; name: string; sku?: string; production_days?: number | null };
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  initialQuantity?: number;
};

export function productDeadlineLabel(days?: number | null) {
  const value = Number(days);
  return Number.isInteger(value) && value > 0
    ? `${value} ${value === 1 ? 'dia útil estimado' : 'dias úteis estimados'}`
    : 'Prazo sob consulta';
}

export default function ProductDeadlineRequest({ storefront, product, defaultName = '', defaultPhone = '', defaultEmail = '', initialQuantity }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(() => initialQuantity == null
    ? ''
    : String(Math.max(1, Math.min(10000, Math.trunc(initialQuantity) || 1))));
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ code: string; whatsapp: string } | null>(null);
  const label = productDeadlineLabel(product.production_days);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await productDeadlineRequestsService.create(storefront, {
        product_id: product.id, quantity: Number(quantity), customer_name: name, customer_phone: phone,
        customer_email: email, customer_message: message, website,
      });
      setSuccess({ code: result.public_code, whatsapp: result.notification_status });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message.replace(/^.*?—\s*/, '') : '';
      setError(detail || 'Não foi possível enviar a solicitação agora.');
    } finally { setBusy(false); }
  }

  if (success) return <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
    <p className="font-semibold">Solicitação recebida · {success.code}</p>
    <p className="mt-1">A equipe analisará a quantidade e entrará em contato para combinar o prazo.</p>
    {storefront === 'loja_3d' && success.whatsapp === 'unconfigured' && <p className="mt-2 text-xs">O aviso já está no painel da Loja 3D. O WhatsApp próprio será ativado quando o novo número for cadastrado.</p>}
  </div>;

  return <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold text-amber-950"><Clock3 size={17} /> {label}</p><p className="mt-1 text-xs text-amber-800">Informe a quantidade desejada.</p></div>{!open && <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white"><MessageCircle size={15} className="mr-1 inline" /> Consultar prazo</button>}</div>
    {open && <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-slate-700">Quantidade desejada<input type="number" min="1" max="10000" required value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Informe a quantidade" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2.5 text-sm" /></label>
      <label className="text-xs font-medium text-slate-700">Nome<input maxLength={160} minLength={2} required value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2.5 text-sm" /></label>
      <label className="text-xs font-medium text-slate-700">WhatsApp com DDD<input type="tel" maxLength={20} required value={phone} onChange={event => setPhone(event.target.value)} placeholder="(87) 99999-9999" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2.5 text-sm" /></label>
      <label className="text-xs font-medium text-slate-700">E-mail (opcional)<input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2.5 text-sm" /></label>
      <label className="sm:col-span-2 text-xs font-medium text-slate-700">Observação (opcional)<textarea maxLength={1000} rows={3} value={message} onChange={event => setMessage(event.target.value)} placeholder="Cor, acabamento, data desejada ou outro detalhe" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2.5 text-sm" /></label>
      <label className="absolute -left-[10000px]" aria-hidden="true">Site<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
      {error && <p role="alert" className="sm:col-span-2 text-xs text-red-700">{error}</p>}
      <div className="sm:col-span-2 flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg bg-amber-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Enviando…' : 'Enviar solicitação'}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-amber-300 px-4 py-2.5 text-amber-950">Cancelar</button></div>
      <p className="sm:col-span-2 text-[11px] leading-relaxed text-amber-800">Esta solicitação não cria pedido, não reserva estoque e não gera cobrança. A negociação acontece antes da confirmação.</p>
    </form>}
  </div>;
}
