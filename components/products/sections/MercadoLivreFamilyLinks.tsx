import { useEffect, useState } from 'react';
import { productService } from '../../../services/products';
import { mercadoLivreService, type MercadoLivreListing } from '../../../services/mercadoLivreService';
import type { Product } from '../../../types/product';
import { findFamilyListing, validateFamilySelection } from './mercadoLivreFamilyLinkCore.js';
import { MercadoLivreListingPrice } from './MercadoLivreListingPrice';

export function MercadoLivreFamilyLinks({ parentId }: { parentId: string }) {
    const [children, setChildren] = useState<Product[]>([]);
    const [links, setLinks] = useState<Array<{ product_id: string; item_id: string; variation_id?: string }>>([]);
    const [rows, setRows] = useState<MercadoLivreListing[]>([]);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [results, setResults] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        setLoading(true);
        void Promise.all([productService.listChildren(parentId), mercadoLivreService.getProductLinks()])
            .then(([products, existing]) => { if (active) { setChildren(products); setLinks(existing.items); } })
            .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao consultar a família.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [parentId]);

    const lookup = async () => {
        setBusy(true); setError(''); setMessage(''); setRows([]); setSelections({}); setResults({});
        try {
            const options = await findFamilyListing(input, mercadoLivreService.discoverProducts,
                (page: number) => setMessage(`Consultando anúncios da conta · página ${page}…`));
            setRows(options);
            setMessage('Escolha abaixo a opção do anúncio que corresponde a cada filho.');
        } catch (cause) { setMessage(''); setError(cause instanceof Error ? cause.message : 'Falha ao consultar o anúncio.'); }
        finally { setBusy(false); }
    };

    const save = async () => {
        setError(''); setMessage(''); setResults({});
        let plan;
        try { plan = validateFamilySelection(children, rows, selections); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Confira as opções selecionadas.'); return; }
        if (!plan.length) return;
        setBusy(true);
        let saved = 0;
        for (const { child, row } of plan) {
            try {
                await mercadoLivreService.linkProduct({ productId: child.id, itemId: row.itemId, variationId: row.variationId, sellerSku: child.sku });
                saved++;
                setResults(current => ({ ...current, [child.id]: 'Vínculo salvo.' }));
                setSelections(current => { const next = { ...current }; delete next[child.id]; return next; });
                setRows(current => current.map(option => option.itemId === row.itemId && option.variationId === row.variationId
                    ? { ...option, existing: [{ productId: child.id, sku: child.sku }] } : option));
                setLinks(current => [...current.filter(link => !(link.item_id === row.itemId && String(link.variation_id || '') === row.variationId)),
                    { product_id: child.id, item_id: row.itemId, variation_id: row.variationId }]);
            } catch (cause) { setResults(current => ({ ...current, [child.id]: cause instanceof Error ? cause.message : 'Não foi possível salvar este vínculo.' })); }
        }
        setMessage(`${saved} de ${plan.length} vínculos salvos. Confira o resultado de cada filho.`);
        setBusy(false);
    };

    return <section className="space-y-4 rounded-xl border border-yellow-200 bg-white p-5 shadow-sm" aria-label="Anúncio Mercado Livre da família">
        <div><h3 className="font-semibold text-slate-900">Vincular anúncio à família</h3>
            <p className="mt-1 text-sm text-slate-600">Cole o anúncio e escolha qual opção corresponde a cada filho. O estoque será associado ao SKU de cada variação.</p></div>
        <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-sm font-medium text-slate-700">Link ou código do anúncio
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Cole o link do Mercado Livre ou MLB…" value={input} disabled={busy || loading} onChange={event => { setInput(event.target.value); setRows([]); setSelections({}); setMessage(''); setError(''); setResults({}); }} />
            </label>
            <button type="button" onClick={() => void lookup()} disabled={busy || loading || !input.trim()} className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Processando…' : 'Consultar anúncio'}</button>
        </div>
        {loading && <p className="text-sm text-slate-500">Carregando filhos e vínculos…</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
        {rows.length > 0 && <div className="rounded-lg bg-yellow-50 p-3 text-sm"><strong>{rows[0].title}</strong><span className="ml-2 text-slate-500">{rows[0].itemId}</span></div>}
        <div className="space-y-3">{children.map(child => <div key={child.id} className="rounded-lg border border-slate-200 p-3">
            <strong className="text-sm">{child.specs?.color || child.specs?.cor || child.name}</strong><span className="ml-2 font-mono text-xs text-slate-500">{child.sku}</span>
            {[...new Set(links.filter(link => link.product_id === child.id).map(link => link.item_id))].map(itemId => <div key={itemId}>
                <p className="mt-1 text-xs text-green-700">Anúncio vinculado: {itemId}</p>
                <MercadoLivreListingPrice key={`${child.id}:${itemId}`} itemId={itemId} parentId={parentId} product={child} />
            </div>)}
            {rows.length > 0 && <label className="mt-2 block text-sm text-slate-600">Opção no Mercado Livre
                <select aria-label={`Opção no Mercado Livre para ${child.sku}`} value={selections[child.id] || ''} disabled={busy} onChange={event => setSelections(current => ({ ...current, [child.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                    <option value="">Escolha a cor ou opção correspondente</option>
                    {rows.map(row => <option key={`${row.itemId}:${row.variationId}`} value={`${row.itemId}:${row.variationId}`} disabled={row.existing.some(link => link.productId !== child.id)}>{row.variation || 'Opção única (sem variações)'}{row.sku ? ` · ${row.sku}` : ''}{row.existing.length ? ' · já vinculada' : ''}</option>)}
                </select>
            </label>}
            {results[child.id] && <p role="status" className="mt-2 text-sm text-slate-700">{results[child.id]}</p>}
        </div>)}</div>
        {!loading && !children.length && <p className="text-sm text-slate-500">Cadastre os filhos desta família antes de vincular o anúncio.</p>}
        {rows.length > 0 && <button type="button" onClick={() => void save()} disabled={busy || !Object.values(selections).some(Boolean)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar vínculos dos filhos</button>}
    </section>;
}
