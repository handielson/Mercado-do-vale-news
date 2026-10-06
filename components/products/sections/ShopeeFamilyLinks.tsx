import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../../../services/products';
import { getShopeeStoreCode, shopeeProductService, type ShopeeProductLink } from '../../../services/shopeeProducts';
import type { Product } from '../../../types/product';

type FamilyLinks = { children: Product[]; links: ShopeeProductLink[] };
const STORES = [
    { code: 'M', name: 'Mercado do Vale' },
    { code: 'G', name: 'Gláucia' },
] as const;

export function ShopeeFamilyLinks({ parentId }: { parentId: string }) {
    const [family, setFamily] = useState<FamilyLinks | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const children = await productService.listChildren(parentId);
            const links = await shopeeProductService.getByProductIds(children.map(child => child.id));
            setFamily({ children, links });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os vínculos da Shopee.');
        } finally {
            setLoading(false);
        }
    }, [parentId]);

    useEffect(() => { void refresh(); }, [refresh]);

    return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Vínculos Shopee das variações">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800"><Store size={18} className="text-[#ee4d2d]" /> Shopee — vínculos das variações</h3>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} /> Atualizar</button>
        </div>
        <p className="mt-1 text-sm text-slate-600">Os anúncios pertencem aos SKUs filhos. Abra a variação para gerenciar seu vínculo; esta ficha do pai apenas os reúne para consulta.</p>
        {loading && <p className="mt-4 text-sm text-slate-500">Consultando variações e vínculos...</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && !family?.children.length && <p className="mt-4 text-sm text-slate-500">Nenhuma variação vinculada a esta família.</p>}
        {!loading && !error && family?.children.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {STORES.map(store => <section key={store.code} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4" aria-label={`Loja ${store.code} — ${store.name}`}>
                <h4 className="text-sm font-bold text-orange-900">Loja {store.code} — {store.name}</h4>
                <div className="mt-3 space-y-2">{family.children.map(child => {
                    const links = family.links.filter(link => String(link.product_id) === String(child.id)
                        && Number(link.shopee_item_id) > 0 && getShopeeStoreCode(link.connection_id) === store.code);
                    return <div key={child.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><strong className="text-sm text-slate-900">{child.sku}</strong><span className="ml-2 text-sm text-slate-500">{child.specs?.color || child.specs?.cor || child.name}</span></div>
                            <div className="flex flex-wrap gap-3">
                                <Link to={`/admin/products/${child.id}`} className="text-xs font-semibold text-blue-700 hover:underline">Abrir variação</Link>
                                {links[0] && <Link to={`/admin/settings/shopee?tab=products&product_id=${encodeURIComponent(child.id)}&connection_id=${encodeURIComponent(String(links[0].connection_id || 'primary'))}`} className="text-xs font-semibold text-orange-800 hover:underline">Editar preço nesta loja</Link>}
                            </div>
                        </div>
                        {links.length ? <div className="mt-2 flex flex-wrap gap-2">{links.map((link, index) => <a
                            key={link.id || `${link.connection_id}-${link.shopee_item_id}-${index}`}
                            href={`https://seller.shopee.com.br/portal/product/${encodeURIComponent(String(link.shopee_item_id))}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs text-orange-900 hover:bg-orange-100"
                        >Item {link.shopee_item_id}{link.shopee_model_sku ? ` · ${link.shopee_model_sku}` : ''}<ExternalLink size={12} /></a>)}</div>
                            : <p className="mt-2 text-xs text-slate-500">Sem vínculo nesta loja.</p>}
                    </div>;
                })}</div>
            </section>)}
        </div> : null}
    </section>;
}
