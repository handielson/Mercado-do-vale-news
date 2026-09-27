import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { vpsApiService } from '@/services/vpsApiService';
import { productStorefrontOffersService, type StorefrontCode, type StorefrontOffer } from '@/services/productStorefrontOffers';
import { categoryService } from '@/services/categories';
import type { Category } from '@/types/category';

const ALL_SITES: { code: StorefrontCode; label: string }[] = [
  { code: 'mercado_do_vale', label: 'Mercado do Vale' },
  { code: 'loja_3d', label: 'Loja 3D' },
];
const emptyOffer = (storefront: StorefrontCode): StorefrontOffer => ({
  storefront, publication_status: 'draft', title: null, description: null, category_label: null, slug: null,
  price_retail: null, price_reseller: null, price_wholesale: null, price_promo: null,
  meta_title: null, meta_description: null,
});
const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';

export default function ProductStorefrontOffersPage({ storefront }: { storefront?: StorefrontCode } = {}) {
  const SITES = ALL_SITES.filter(site => !storefront || site.code === storefront);
  const [params, setParams] = useSearchParams();
  const [sku, setSku] = useState(params.get('sku') || '');
  const [product, setProduct] = useState<{ id: string; sku: string; name: string; stock_quantity: number; images?: string[]; is_print3d?: boolean } | null>(null);
  const [offers, setOffers] = useState<Record<StorefrontCode, StorefrontOffer>>({ mercado_do_vale: emptyOffer('mercado_do_vale'), loja_3d: emptyOffer('loja_3d') });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<StorefrontCode | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (targetSku: string) => {
    const normalizedSku = targetSku.trim();
    if (!normalizedSku) return;
    setLoading(true); setError(''); setNotice(''); setProduct(null);
    try {
      const matches = await vpsApiService.getProducts({ sku: normalizedSku, status: 'all', limit: 10, noCache: true });
      const found = matches?.find(row => String(row.sku).toLowerCase() === normalizedSku.toLowerCase());
      if (!found) throw new Error('SKU não encontrado no cadastro central. Salve o produto antes de configurar os sites.');
      const { offers: saved } = await productStorefrontOffersService.list(found.id);
      setProduct(found);
      setOffers({
        mercado_do_vale: { ...emptyOffer('mercado_do_vale'), ...saved.find(row => row.storefront === 'mercado_do_vale') },
        loja_3d: { ...emptyOffer('loja_3d'), ...saved.find(row => row.storefront === 'loja_3d') },
      });
      setParams({ sku: found.sku }, { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o produto.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    categoryService.list(true)
      .then(rows => { if (active) setCategories(rows); })
      .catch(() => { if (active) setError('Não foi possível carregar as categorias. Tente novamente antes de publicar.'); })
      .finally(() => { if (active) setCategoriesLoading(false); });
    const initialSku = params.get('sku');
    if (initialSku) void load(initialSku);
    return () => { active = false; };
  }, []);

  const change = (site: StorefrontCode, patch: Partial<StorefrontOffer>) => setOffers(current => ({ ...current, [site]: { ...current[site], ...patch } }));
  const save = async (site: StorefrontCode) => {
    if (!product) return;
    if (offers[site].publication_status === 'published' && !offers[site].category_label?.trim()) {
      setError(`Escolha a categoria do ${SITES.find(item => item.code === site)?.label} antes de publicar.`);
      return;
    }
    setSaving(site); setError(''); setNotice('');
    try {
      const updated = await productStorefrontOffersService.save(product.id, offers[site]);
      change(site, updated);
      setNotice(`${SITES.find(item => item.code === site)?.label} atualizado.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a oferta.'); }
    finally { setSaving(null); }
  };

  return <div className="mx-auto max-w-5xl space-y-6 p-4 pb-16 sm:p-8">
    <div><Link to="/admin/products" className="text-sm text-blue-700 hover:underline">← Produtos centrais</Link><h1 className="mt-3 text-2xl font-bold text-slate-900">{storefront === 'loja_3d' ? 'Catálogo e preços 3D' : 'Publicação nos sites'}</h1><p className="mt-2 text-sm text-slate-600">Cada site tem sua oferta, preço e apresentação. SKU, fotos, vídeo, características e estoque permanecem no produto central.</p></div>
    <form onSubmit={event => { event.preventDefault(); void load(sku); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5"><label className="min-w-64 flex-1 text-sm font-medium">SKU do produto<input value={sku} onChange={event => setSku(event.target.value)} className={fieldClass} placeholder="Informe o SKU cadastrado" /></label><button type="submit" disabled={loading} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Buscando...' : 'Abrir produto'}</button></form>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    {product && <><div className="rounded-xl border bg-white p-5"><strong>{product.name}</strong><p className="mt-1 text-sm text-slate-600">SKU {product.sku} · Estoque central: {product.stock_quantity} · {product.images?.length || 0} fotos · Produto 3D: {product.is_print3d ? 'sim' : 'não'}</p></div><div className="grid gap-5 lg:grid-cols-2">{SITES.map(site => {
      const offer = offers[site.code];
      return <section key={site.code} className={`space-y-4 rounded-xl border p-5 ${site.code === 'loja_3d' ? 'border-violet-200 bg-violet-50' : 'bg-white'}`}><div className="flex items-center justify-between gap-3"><h2 className={`text-lg font-bold ${site.code === 'loja_3d' ? 'text-violet-900' : ''}`}>{site.label}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{offer.publication_status}</span></div>
        <label className="block text-sm font-medium">Visibilidade<select value={offer.publication_status} onChange={event => change(site.code, { publication_status: event.target.value as StorefrontOffer['publication_status'] })} className={fieldClass}><option value="draft">Rascunho — nunca exibir</option><option value="published">Publicado neste site</option><option value="hidden">Oculto neste site</option></select></label>
        <label className="block text-sm font-medium">Nome neste site<input value={offer.title || ''} onChange={event => change(site.code, { title: event.target.value || null })} className={fieldClass} placeholder={product.name} /></label>
        <label className="block text-sm font-medium">Descrição neste site<textarea value={offer.description || ''} onChange={event => change(site.code, { description: event.target.value || null })} className={fieldClass} rows={3} placeholder="Se vazio, usa a descrição do cadastro central" /></label>
        <label className="block text-sm font-medium">Categoria neste site
          <select value={offer.category_label || ''} onChange={event => change(site.code, { category_label: event.target.value || null })} className={fieldClass} disabled={categoriesLoading} aria-required={offer.publication_status === 'published'}>
            <option value="">{categoriesLoading ? 'Carregando categorias...' : 'Selecione antes de publicar'}</option>
            {offer.category_label && !categories.some(category => category.name === offer.category_label) && <option value={offer.category_label}>{offer.category_label} (categoria já salva)</option>}
            {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">A escolha vale somente para o {site.label}; o outro site pode usar outra categoria.</span>
          <Link to="/admin/settings/categories" className="mt-1 inline-block text-xs font-normal text-blue-700 hover:underline">Cadastrar ou editar categorias</Link>
        </label>
        <CurrencyInput label="Preço de varejo neste site" value={offer.price_retail ?? 0} onChange={value => change(site.code, { price_retail: value })} />
        <div className="grid gap-3 sm:grid-cols-2"><CurrencyInput label="Revenda neste site" value={offer.price_reseller ?? 0} onChange={value => change(site.code, { price_reseller: value || null })} /><CurrencyInput label="Atacado neste site" value={offer.price_wholesale ?? 0} onChange={value => change(site.code, { price_wholesale: value || null })} /></div>
        <CurrencyInput label="Preço promocional" value={offer.price_promo ?? 0} onChange={value => change(site.code, { price_promo: value || null })} />
        <label className="block text-sm font-medium">Endereço (slug) neste site<input value={offer.slug || ''} onChange={event => change(site.code, { slug: event.target.value || null })} className={fieldClass} placeholder="Opcional" /></label>
        <label className="block text-sm font-medium">Título para busca neste site<input value={offer.meta_title || ''} onChange={event => change(site.code, { meta_title: event.target.value || null })} className={fieldClass} placeholder="Opcional" /></label>
        <label className="block text-sm font-medium">Descrição para busca neste site<textarea value={offer.meta_description || ''} onChange={event => change(site.code, { meta_description: event.target.value || null })} className={fieldClass} rows={2} placeholder="Opcional" /></label>
        <button type="button" onClick={() => void save(site.code)} disabled={saving !== null || categoriesLoading || (offer.publication_status === 'published' && !offer.category_label)} className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${site.code === 'loja_3d' ? 'bg-[var(--print3d-accent)] hover:bg-[var(--print3d-accent-hover)]' : 'bg-blue-700'}`}>{saving === site.code ? 'Salvando...' : offer.publication_status === 'published' && !offer.category_label ? 'Escolha uma categoria para publicar' : `Salvar ${site.label}`}</button>
      </section>;
    })}</div><p className="text-xs text-amber-800">A publicação da oferta não habilita a compra: o checkout deve validar o preço e a disponibilidade do site antes de aceitar pedidos. O catálogo atual e o bot da Val ainda usam o fluxo legado do Mercado do Vale. Por segurança, publicar uma oferta do Mercado do Vale fica bloqueado até a migração conjunta do site, checkout e bot.</p></>}
  </div>;
}
