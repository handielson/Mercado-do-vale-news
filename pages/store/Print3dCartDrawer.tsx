import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentTermsPreview, saveCheckoutCart } from '@/services/print3dCheckoutClient';
import Print3dShippingCalculator from './Print3dShippingCalculator';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { formatPrice } from '@/services/installmentCalculator';
import { productStorefrontOffersService, type Print3dQuote } from '@/services/productStorefrontOffers';
import type { CatalogProduct } from '@/types/catalog';

export type Print3dCartLine = { product: CatalogProduct & { available_stock?: number }; quantity: number };

export default function Print3dCartDrawer({ lines, preview, onQuantity, onClose }: {
  lines: Print3dCartLine[];
  preview: boolean;
  onQuantity: (id: string, quantity: number) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Print3dQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (preview || lines.length === 0) { setQuote(null); setBusy(false); return; }
    let active = true;
    setBusy(true);
    setQuote(null);
    setError('');
    productStorefrontOffersService.quotePrint3d(lines.map(line => ({ product_id: line.product.id, quantity: line.quantity })))
      .then(result => { if (active) setQuote(result); })
      .catch(() => { if (active) setError('Não foi possível conferir preço e disponibilidade agora.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [lines, preview]);

  const previewTotal = lines.reduce((sum, line) => sum + line.product.price_retail * line.quantity, 0);
  const subtotal = preview ? previewTotal : quote?.subtotal;
  const schedule = subtotal != null && subtotal > 0 && (preview || quote?.payment_schedule)
    ? paymentTermsPreview(subtotal, 0, { initial_payment_bps: 5000, shipping_payment_mode: 'later' }) : null;
  return <div className="fixed inset-0 z-[60] bg-[#171d1a]/60" onClick={onClose} role="presentation">
    <aside role="dialog" aria-modal="true" aria-label="Carrinho da loja 3D" onClick={event => event.stopPropagation()} className="ml-auto flex h-full w-full max-w-md flex-col bg-[#faf9f6] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#deded8] px-6 py-5"><div className="flex items-center gap-3"><ShoppingBag size={21} /><h2 className="text-xl font-semibold">Seu carrinho</h2></div><button type="button" aria-label="Fechar carrinho" onClick={onClose}><X size={22} /></button></div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{lines.length === 0 ? <p className="text-sm text-[#69716c]">Seu carrinho está vazio.</p> : lines.map(line => {
        const quoted = quote?.items.find(item => item.product_id === line.product.id);
        const ready = Math.min(Math.max(0, Number(line.product.available_stock ?? line.product.stock_quantity) || 0), line.quantity);
        const preorder = line.quantity - ready;
        const previewAvailability = `${ready} pronta${ready === 1 ? '' : 's'}${preorder > 0
          ? line.product.print3d_preorder_enabled && Number(line.product.production_days) > 0
            ? ` · ${preorder} sob encomenda (${line.product.production_days} dias de produção)`
            : ` · ${preorder} ${preorder === 1 ? 'indisponível' : 'indisponíveis'}`
          : ''}`;
        return <div key={line.product.id} className="border-b border-[#deded8] py-5 first:pt-0"><div className="flex justify-between gap-4"><div><p className="font-medium">{line.product.name}</p><p className="mt-1 text-xs text-[#69716c]">SKU {line.product.sku}</p></div><strong className="whitespace-nowrap text-sm">{formatPrice(quoted?.unit_price ?? line.product.price_retail)}</strong></div><div className="mt-4 flex items-center justify-between"><div className="flex items-center border border-[#cbd0c9]"><button type="button" aria-label={`Diminuir ${line.product.name}`} onClick={() => onQuantity(line.product.id, line.quantity - 1)} className="p-2"><Minus size={14} /></button><span className="min-w-8 text-center text-sm">{line.quantity}</span><button type="button" aria-label={`Aumentar ${line.product.name}`} onClick={() => onQuantity(line.product.id, line.quantity + 1)} className="p-2"><Plus size={14} /></button></div><span className="text-xs text-[#69716c]">{quoted?.status === 'unavailable' ? 'Quantidade indisponível' : quoted ? `${quoted.ready_quantity} pronta${quoted.ready_quantity === 1 ? '' : 's'}${quoted.preorder_quantity ? ` · ${quoted.preorder_quantity} sob encomenda (${quoted.production_days} dias de produção)` : ''}` : preview ? previewAvailability : 'Conferindo disponibilidade...'}</span></div></div>;
      })}{lines.length > 0 && <Print3dShippingCalculator items={lines.map(line => ({ product_id: line.product.id, quantity: line.quantity }))} preview={preview} />}</div>
      <div className="border-t border-[#deded8] px-6 py-5"><div className="flex justify-between text-sm"><span>Subtotal {preview ? 'ilustrativo' : 'cotado'}</span><strong>{busy ? 'Conferindo...' : quote?.subtotal != null ? formatPrice(quote.subtotal) : preview ? formatPrice(previewTotal) : 'Indisponível'}</strong></div>{lines.length > 0 && schedule && <div className="mt-4 space-y-2 border-t border-[#deded8] pt-4 text-sm"><div className="flex justify-between gap-4"><span>Entrada mínima (50% dos produtos)</span><strong>{formatPrice(schedule.initial_cents)}</strong></div>{schedule.balance_cents > 0 && <div className="flex justify-between gap-4"><span>Saldo dos produtos antes do envio</span><strong>{formatPrice(schedule.balance_cents)}</strong></div>}</div>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<p className="mt-4 text-xs leading-relaxed text-[#69716c]">{preview ? 'Prévia visual: produtos e valores ilustrativos.' : quote?.notice || 'Preço e estoque serão conferidos no servidor.'} Na finalização, escolha de 50% a 100% de entrada e quando pagar o frete.</p><button type="button" disabled={!lines.length || busy} onClick={() => { try { if (!preview) saveCheckoutCart(lines.map(line => ({ product_id: line.product.id, quantity: line.quantity }))); navigate("/loja-3d/checkout" + (preview ? "?demo=1" : "")); } catch { setError("Não foi possível guardar o carrinho neste navegador."); } }} className="mt-5 w-full rounded-md bg-[#1c2220] py-3 text-sm font-semibold text-white disabled:opacity-40">{preview ? "Ver finalização de exemplo" : "Continuar para entrega"}</button></div>
    </aside>
  </div>;
}
