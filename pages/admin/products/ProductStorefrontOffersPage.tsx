import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { vpsApiService } from '@/services/vpsApiService';
import { productStorefrontOffersService, type StorefrontCode, type StorefrontOffer } from '@/services/productStorefrontOffers';
import { categoryService } from '@/services/categories';
import type { Category } from '@/types/category';
import { fillStorefrontOfferFromProduct } from '@/utils/storefrontOfferDefaults.mjs';

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
type CentralProduct = {
  id: string; sku: string; name: string; description?: string | null; category_id?: string | null; category_name?: string | null;
  stock_quantity: number; images?: string[]; is_print3d?: boolean; slug?: string | null;
  price_retail?: number | null; price_reseller?: number | null; price_wholesale?: number | null; price_promo?: number | null;
  meta_title?: string | null; meta_description?: string | null;
};

export default function ProductStorefrontOffersPage({ storefront }: { storefront?: StorefrontCode } = {}) {
  const SITES = ALL_SITES.filter(site => !storefront || site.code === storefront);
  const [params, setParams] = useSearchParams();
  const [sku, setSku] = useState(params.get('sku') || '');
  const [product, setProduct] = useState<CentralProduct | null>(null);
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
    setLoading(true); setCategoriesLoading(true); setError(''); setNotice(''); setProduct(null);
    try {
      const [matches, categoryRows] = await Promise.all([
        vpsApiService.getProducts({ sku: normalizedSku, status: 'all', limit: 10, noCache: true }),
        categoryService.list(true),
      ]);
      const found = matches?.find(row => String(row.sku).toLowerCase() === normalizedSku.toLowerCase());
      if (!found) throw new Error('SKU não encontrado no cadastro central. Salve o produto antes de configurar os sites.');
      const [{ offers: saved }, fullProduct] = await Promise.all([
        productStorefrontOffersService.list(found.id),
        vpsApiService.getProductById(found.id, true),
      ]);
      const central = { ...found, ...(fullProduct || {}) } as CentralProduct;
      const categoryName = central.category_name || categoryRows.find(category => category.id === central.category_id)?.name || null;
      setCategories(categoryRows);
      setProduct(central);
      setOffers({
        mercado_do_vale: fillStorefrontOfferFromProduct('mercado_do_vale', saved.find(row => row.storefront === 'mercado_do_vale'), central, categoryName),
        loja_3d: fillStorefrontOfferFromProduct('loja_3d', saved.find(row => row.storefront === 'loja_3d'), central, categoryName),
      });
      setParams({ sku: found.sku }, { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o produto.'); }
    finally { setLoading(false); setCategoriesLoading(false); }
  };

  useEffect(() => {
    const initialSku = params.get('sku');
    if (initialSku) void load(initialSku);
  }, []);

  const change = (site: StorefrontCode, patch: Partial<StorefrontOffer>) => setOffers(current => ({ ...current, [site]: { ...current[site], ...patch } }));
  const save = async (site: StorefrontCode) => {
    if (!product) return;
    if (offers[site].publication_status === 'published' && !offers[site].category_label?.trim()) {
      setError(`Escolha a categoria do ${SITES.find(item => item.code === site)?.label} antes de publicar.`);
      return;
    }
    if (offers[site].publication_status === 'published' && !(Number(offers[site].price_retail) > 0)) {
      setError(`Informe o preço de venda do ${SITES.find(item => item.code === site)?.label} antes de publicar.`);
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
    {product && <><div className="rounded-xl border bg-white p-5"><strong>{product.name}</strong><p className="mt-1 text-sm text-slate-600">SKU {product.sku} · Estoque central: {product.stock_quantity} · {product.images?.length || 0} fotos · Produto 3D: {product.is_print3d ? 'sim' : 'não'}</p>{storefront === 'loja_3d' && !product.is_print3d && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Este SKU ainda não está marcado como produto 3D. <Link className="font-semibold underline" to={`/admin/products/${product.id}`}>Abra o cadastro do produto</Link>, marque a opção de impressão 3D e salve antes de publicá-lo na Loja 3D.</p>}</div><div className="grid gap-5 lg:grid-cols-2">{SITES.map(site => {
      const offer = offers[site.code];
      return <section key={site.code} className={`space-y-4 rounded-xl border p-5 ${site.code === 'loja_3d' ? 'border-violet-200 bg-violet-50' : 'bg-white'}`}><div className="flex items-center justify-between gap-3"><h2 className={`text-lg font-bold ${site.code === 'loja_3d' ? 'text-violet-900' : ''}`}>{site.label}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{offer.publication_status}</span></div>
        <div className="rounded-lg border border-violet-200 bg-white/80 p-3 text-sm text-slate-700"><strong>Como preencher</strong><p className="mt-1">Nome, descrição, categoria, preços e dados de busca foram copiados do cadastro central quando estavam disponíveis. Altere somente o que deve ser diferente no {site.label}.</p><p className="mt-1">Para publicar, revise obrigatoriamente <strong>visibilidade, categoria e preço de venda</strong>. Revenda, atacado, promoção, endereço e dados de busca são opcionais.</p></div>
        <label className="block text-sm font-medium">Visibilidade<select value={offer.publication_status} onChange={event => change(site.code, { publication_status: event.target.value as StorefrontOffer['publication_status'] })} className={fieldClass}><option value="draft">Rascunho — salvar sem mostrar no site</option><option value="published">Publicado — mostrar para os clientes</option><option value="hidden">Oculto — retirar do site sem apagar</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Use Rascunho enquanto estiver preenchendo. Escolha Publicado somente depois de revisar os campos.</span></label>
        <label className="block text-sm font-medium">Nome exibido neste site<input value={offer.title || ''} onChange={event => change(site.code, { title: event.target.value || null })} className={fieldClass} placeholder="Informe o nome que o cliente verá" /><span className="mt-1 block text-xs font-normal text-slate-500">Copiado do produto central. Pode ser adaptado para este site.</span></label>
        <label className="block text-sm font-medium">Descrição exibida neste site<textarea value={offer.description || ''} onChange={event => change(site.code, { description: event.target.value || null })} className={fieldClass} rows={4} placeholder="Explique o produto, medidas, material, acabamento e uso" /><span className="mt-1 block text-xs font-normal text-slate-500">Copiada do cadastro central quando existe. Complete as informações que ajudam o cliente a comprar.</span></label>
        <label className="block text-sm font-medium">Categoria neste site
          <select value={offer.category_label || ''} onChange={event => change(site.code, { category_label: event.target.value || null })} className={fieldClass} disabled={categoriesLoading} aria-required={offer.publication_status === 'published'}>
            <option value="">{categoriesLoading ? 'Carregando categorias...' : 'Selecione antes de publicar'}</option>
            {offer.category_label && !categories.some(category => category.name === offer.category_label) && <option value={offer.category_label}>{offer.category_label} (categoria já salva)</option>}
            {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">Copiada da categoria central quando existe. A escolha vale somente para o {site.label}; o outro site pode usar outra categoria.</span>
          <Link to="/admin/settings/categories" className="mt-1 inline-block text-xs font-normal text-blue-700 hover:underline">Cadastrar ou editar categorias</Link>
        </label>
        <div><CurrencyInput label="Preço de venda para o cliente" value={offer.price_retail ?? 0} onChange={value => change(site.code, { price_retail: value })} /><p className="mt-1 text-xs text-slate-500">Obrigatório para publicar. Foi copiado do preço de varejo central e pode ser alterado neste site.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><CurrencyInput label="Preço para revenda" value={offer.price_reseller ?? 0} onChange={value => change(site.code, { price_reseller: value || null })} /><p className="mt-1 text-xs text-slate-500">Opcional. Use somente se vender para revendedores.</p></div><div><CurrencyInput label="Preço para atacado" value={offer.price_wholesale ?? 0} onChange={value => change(site.code, { price_wholesale: value || null })} /><p className="mt-1 text-xs text-slate-500">Opcional. Use somente se houver tabela de atacado.</p></div></div>
        <div><CurrencyInput label="Preço promocional" value={offer.price_promo ?? 0} onChange={value => change(site.code, { price_promo: value || null })} /><p className="mt-1 text-xs text-slate-500">Opcional. Quando usado, precisa ser menor que o preço normal.</p></div>
        <label className="block text-sm font-medium">Endereço do produto (slug)<input value={offer.slug || ''} onChange={event => change(site.code, { slug: event.target.value || null })} className={fieldClass} placeholder="Ex.: suporte-antena-ku" /><span className="mt-1 block text-xs font-normal text-slate-500">Opcional. É a parte final do link do produto; use letras, números e hífens.</span></label>
        <label className="block text-sm font-medium">Título para Google e buscas<input value={offer.meta_title || ''} onChange={event => change(site.code, { meta_title: event.target.value || null })} className={fieldClass} placeholder="Opcional" /><span className="mt-1 block text-xs font-normal text-slate-500">Opcional. Pode repetir o nome do produto.</span></label>
        <label className="block text-sm font-medium">Descrição para Google e buscas<textarea value={offer.meta_description || ''} onChange={event => change(site.code, { meta_description: event.target.value || null })} className={fieldClass} rows={2} placeholder="Resumo curto do produto" /><span className="mt-1 block text-xs font-normal text-slate-500">Opcional. Escreva um resumo curto para resultados de busca.</span></label>
        <button type="button" onClick={() => void save(site.code)} disabled={saving !== null || categoriesLoading || (offer.publication_status === 'published' && (!offer.category_label || !(Number(offer.price_retail) > 0) || (site.code === 'loja_3d' && !product.is_print3d)))} className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${site.code === 'loja_3d' ? 'bg-[var(--print3d-accent)] hover:bg-[var(--print3d-accent-hover)]' : 'bg-blue-700'}`}>{saving === site.code ? 'Salvando...' : site.code === 'loja_3d' && offer.publication_status === 'published' && !product.is_print3d ? 'Marque o produto como 3D antes de publicar' : offer.publication_status === 'published' && !offer.category_label ? 'Escolha uma categoria para publicar' : offer.publication_status === 'published' && !(Number(offer.price_retail) > 0) ? 'Informe o preço de venda para publicar' : `Salvar ${site.label}`}</button>
      </section>;
    })}</div><p className="text-xs text-amber-800">A publicação da oferta não habilita a compra: o checkout deve validar o preço e a disponibilidade do site antes de aceitar pedidos. O catálogo atual e o bot da Val ainda usam o fluxo legado do Mercado do Vale. Por segurança, publicar uma oferta do Mercado do Vale fica bloqueado até a migração conjunta do site, checkout e bot.</p></>}
  </div>;
}
