import { useMemo, useState } from 'react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { mercadoLivreService } from '../../../services/mercadoLivreService';
import MercadoLivrePricingPolicy, { PricingSummary } from '../../../pages/admin/settings/MercadoLivrePricingPolicy';
import { createBatch, createDraft, editField, normalizeProduct } from '../../../services/mercadoLivrePreparation';

const money = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MercadoLivreListingPrice({ itemId, parentId, product }: { itemId: string; parentId: string; product: any }) {
    const [data, setData] = useState<any>(null);
    const [price, setPrice] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [confirmShared, setConfirmShared] = useState(false);
    const [confirmPromotion, setConfirmPromotion] = useState(false);
    const [quote, setQuote] = useState<any>(null);
    const calculatorBatch = useMemo(() => {
        if (!data || !/^MLB\d+$/.test(data.categoryId || '')
            || !['gold_special', 'gold_pro'].includes(data.listingTypeId)
            || !['me2', 'custom'].includes(data.shippingMode)) return null;
        const local = normalizeProduct(product);
        const snapshot = { schema: 'mdv.ml.catalog.v1' as const, sellerId: data.sellerId,
            capturedAt: new Date().toISOString(), complete: false, products: [local], links: [], listings: [] };
        const source = { kind: 'marketplace_reference' as const, reference: `anúncio:${itemId}` };
        let draft = createDraft(local, snapshot);
        draft = editField(draft, 'categoryId', data.categoryId, source);
        draft = editField(draft, 'priceCents', data.priceCents, source);
        draft = editField(draft, 'commercialPolicy', { listingTypeId: data.listingTypeId, shipping: { mode: data.shippingMode } }, source);
        return { ...createBatch(snapshot), drafts: [draft] };
    }, [data, product, itemId]);
    const calculate = async (operation: () => Promise<void>) => {
        setBusy(true); setError(''); setQuote(null);
        try { await operation(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar as tarifas e calcular o preço.'); }
        finally { setBusy(false); }
    };

    const load = async () => {
        setBusy(true); setError(''); setMessage(''); setQuote(null); setConfirmShared(false); setConfirmPromotion(false); setData(null);
        try {
            const current = await mercadoLivreService.getListingPrice(itemId, parentId);
            setData(current); setPrice(current.priceCents);
        } catch (cause) {
            const detail = cause instanceof Error ? cause.message : 'Consulta indisponível.';
            setError(/404.*(Not Found|Route|route)/i.test(detail)
                ? 'A edição de preços precisa ser publicada na API da VPS para funcionar nesta prévia local.' : detail);
        } finally { setBusy(false); }
    };
    const update = async () => {
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await mercadoLivreService.updateListingPrice(itemId, { parentId, priceCents: price,
                expectedPriceCents: data.priceCents, confirmAllVariations: confirmShared, confirmPromotionEffect: confirmPromotion });
            setData(null);
            setMessage(`Preço confirmado no Mercado Livre: ${money(result.priceCents)}. Consulte novamente para conferir promoções e preço de venda.`);
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar a atualização. Consulte o anúncio novamente.'); }
        finally { setBusy(false); }
    };
    return <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
        <button type="button" disabled={busy} onClick={() => void load()} className="text-sm font-semibold text-blue-700 hover:underline disabled:opacity-50">{busy ? 'Processando…' : data ? 'Consultar preço novamente' : 'Preço de venda e calculadora de taxas'}</button>
        {data && <>
            <div className="text-sm text-slate-700">Preço padrão: <strong>{money(data.priceCents)}</strong> · Preço de venda: <strong>{money(data.salePriceCents)}</strong></div>
            {data.automation ? <p className="text-sm text-amber-800">O anúncio usa automatização de preços. Ajuste a regra no Mercado Livre.</p> : <>
                <CurrencyInput value={price} onChange={setPrice} label={`Novo preço · ${itemId}`} disabled={busy} />
                <details className="rounded-lg border bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-blue-700">Calculadora de taxas e lucro · {product.sku}</summary>
                    {calculatorBatch ? <fieldset disabled={busy} className="mt-3 space-y-3">
                        <MercadoLivrePricingPolicy batch={calculatorBatch} active={product.id} run={calculate} existingListing logisticType={data.logisticType || ''}
                            onApply={drafts => setQuote(drafts[0]?.fields.commercialPolicy?.value?.pricingQuote)} />
                        <PricingSummary quote={quote} />
                        {quote && <button type="button" disabled={busy} onClick={() => setPrice(quote.priceCents)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Usar preço sugerido: {money(quote.priceCents)}</button>}
                    </fieldset> : <p className="mt-2 text-sm text-amber-800">A consulta precisa trazer categoria, tipo de anúncio e modalidade de envio para calcular as tarifas. Publique a atualização da API e consulte novamente.</p>}
                </details>
                {data.variations.length > 1 && <label className="flex items-start gap-2 text-sm text-amber-900">
                    <input type="checkbox" checked={confirmShared} disabled={busy} onChange={event => setConfirmShared(event.target.checked)} />
                    <span>Aplicar o mesmo preço a todas as opções deste anúncio: {data.variations.map((variation: any) => variation.label || 'Opção sem nome').join(', ')}.</span>
                </label>}
                {data.promotion && <label className="flex items-start gap-2 text-sm text-amber-900">
                    <input type="checkbox" checked={confirmPromotion} disabled={busy} onChange={event => setConfirmPromotion(event.target.checked)} />
                    <span>Estou ciente de que alterar o preço padrão pode afetar a promoção atual.</span>
                </label>}
                <button type="button" onClick={() => void update()} disabled={busy || price <= 0 || price === data.priceCents || (data.variations.length > 1 && !confirmShared) || (data.promotion && !confirmPromotion)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Atualizar no Mercado Livre</button>
                <p className="text-xs text-slate-500">Altera o preço deste anúncio no Mercado Livre. O preço da loja e dos outros canais permanece separado.</p>
            </>}
        </>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    </div>;
}
