import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { ProductWorkspaceNav } from '@/components/products/ProductWorkspaceNav';
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
  parent_id?: string | null; is_parent?: boolean | number; status?: string;
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
  const [familyProducts, setFamilyProducts] = useState<CentralProduct[]>([]);
  const [familyName, setFamilyName] = useState('');
  const [savingFamily, setSavingFamily] = useState<StorefrontCode | null>(null);
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<StorefrontCode | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const load = async (targetSku: string) => {
    const normalizedSku = targetSku.trim();
    if (!normalizedSku) return;
    setLoading(true); setCategoriesLoading(true); setError(''); setNotice(''); setProduct(null); setFamilyProducts([]); setFamilyName('');
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
      const familyId = central.is_parent ? central.id : central.parent_id;
      if (familyId) {
        const [children, parent] = await Promise.all([
          vpsApiService.getProductsByParentId(familyId),
          vpsApiService.getProductById(familyId, true),
        ]);
        setFamilyProducts((children || []) as CentralProduct[]);
        setFamilyName(parent?.name || parent?.sku || 'Família de variações');
      } else {
        setFamilyProducts([central]);
      }
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

  const createStorefrontCategory = async (site: StorefrontCode) => {
    const name = newCategoryName.trim();
    if (!name) {
      setError('Informe o nome da nova categoria.');
      return;
    }

    setCreatingCategory(true);
    setError('');
    setNotice('');
    try {
      const existing = categories.find(category => category.name.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0);
      const category = existing || await categoryService.create({
        name,
        config: { storefronts: [site] },
        warranty_days: 90,
        production_days: 0,
        extended_warranty_enabled: false,
      });

      setCategories(current => {
        if (current.some(item => item.id === category.id)) return current;
        return [...current, category].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      });
      change(site, { category_label: category.name });
      setNewCategoryName('');
      setCreatingCategoryFor(null);
      const siteLabel = ALL_SITES.find(item => item.code === site)?.label || site;
      setNotice(existing
        ? `A categoria ${category.name} já existia e foi selecionada no ${siteLabel}.`
        : `Categoria ${category.name} criada para o ${siteLabel} e selecionada. Salve a oferta para aplicar ao produto.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a categoria.');
    } finally {
      setCreatingCategory(false);
    }
  };

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

  const publishFamily = async (site: StorefrontCode) => {
    if (!product || familyProducts.length < 2) return;
    setSavingFamily(site); setError(''); setNotice('');
    try {
      const prepared = await Promise.all(familyProducts.map(async candidate => {
        const [{ offers: saved }, fullProduct] = await Promise.all([
          productStorefrontOffersService.list(candidate.id),
          vpsApiService.getProductById(candidate.id, true),
        ]);
        const central = { ...candidate, ...(fullProduct || {}) } as CentralProduct;
        const categoryName = central.category_name || categories.find(category => category.id === central.category_id)?.name || null;
        const current = central.id === product.id
          ? offers[site]
          : fillStorefrontOfferFromProduct(site, saved.find(row => row.storefront === site), central, categoryName);
        return { product: central, offer: { ...current, publication_status: 'published' as const,
          category_label: offers[site].category_label } };
      }));
      const problems = prepared.flatMap(({ product: item, offer }) => {
        const fields: string[] = [];
        if (item.status !== 'active') fields.push('produto inativo');
        if (site === 'loja_3d' && !Number(item.is_print3d)) fields.push('não marcado como produto 3D');
        if (!offer.category_label?.trim()) fields.push('sem categoria');
        if (!(Number(offer.price_retail) > 0)) fields.push('sem preço de venda');
        return fields.length ? [`${item.sku}: ${fields.join(', ')}`] : [];
      });
      if (problems.length) throw new Error(`A família não foi publicada. Corrija todas as variações primeiro: ${problems.join(' | ')}`);
      await Promise.all(prepared.map(item => productStorefrontOffersService.save(item.product.id, item.offer)));
      change(site, { publication_status: 'published' });
      setNotice(`${prepared.length} variações da família foram publicadas no ${SITES.find(item => item.code === site)?.label}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível publicar a família.'); }
    finally { setSavingFamily(null); }
  };

  return <div className="mx-auto max-w-5xl space-y-6 p-4 pb-16 sm:p-8">
    <div><Link to="/admin/products" className="text-sm text-blue-700 hover:underline">← Produtos centrais</Link><h1 className="mt-3 text-2xl font-bold text-slate-900">{storefront === 'loja_3d' ? 'Catálogo e preços 3D' : 'Publicação nos sites'}</h1><p className="mt-2 text-sm text-slate-600">Cada site tem sua oferta, preço e apresentação. A descrição, SKU, fotos, vídeo, características e estoque vêm sempre do produto central.</p></div>
    <form onSubmit={event => { event.preventDefault(); void load(sku); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5"><label className="min-w-64 flex-1 text-sm font-medium">SKU do produto<input value={sku} onChange={event => setSku(event.target.value)} className={fieldClass} placeholder="Informe o SKU cadastrado" /></label><button type="submit" disabled={loading} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Buscando...' : 'Abrir produto'}</button></form>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    {product && <><ProductWorkspaceNav productId={product.id} sku={product.sku} active="storefronts" /><div className="rounded-xl border bg-white p-5"><strong>{product.name}</strong><p className="mt-1 text-sm text-slate-600">SKU {product.sku} · Estoque central: {product.stock_quantity} · {product.images?.length || 0} fotos · Produto 3D: {product.is_print3d ? 'sim' : 'não'}</p>{storefront === 'loja_3d' && !product.is_print3d && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Este SKU ainda não está marcado como produto 3D. <Link className="font-semibold underline" to={`/admin/products/${product.id}`}>Abra o cadastro do produto</Link>, marque a opção de impressão 3D e salve antes de publicá-lo na Loja 3D.</p>}</div>
    {familyProducts.length > 1 && <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="font-bold text-violet-950">Família: {familyName}</h2><p className="mt-1 text-sm text-violet-800">{familyProducts.length} variações vinculadas. A categoria desta tela será compartilhada; cada filho mantém descrição, nome, preço, estoque e SKU próprios no cadastro central.</p></div>
        {SITES.map(site => <button key={site.code} type="button" onClick={() => void publishFamily(site.code)} disabled={savingFamily !== null || saving !== null || categoriesLoading} className="shrink-0 rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{savingFamily === site.code ? 'Conferindo e publicando...' : `Publicar todas no ${site.label}`}</button>)}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{familyProducts.map(item => <button key={item.id} type="button" onClick={() => { setSku(item.sku); void load(item.sku); }} className={`rounded-lg border p-3 text-left text-sm ${item.id === product.id ? 'border-violet-500 bg-white ring-1 ring-violet-500' : 'border-violet-200 bg-white/70 hover:bg-white'}`}><span className="block font-semibold text-slate-900">{item.sku}</span><span className="mt-1 block truncate text-xs text-slate-600">{item.name}</span><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${Number(item.is_print3d) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{Number(item.is_print3d) ? 'Pronto para Loja 3D' : 'Marcar como produto 3D'}</span></button>)}</div>
    </section>}
    <div className="grid gap-5 lg:grid-cols-2">{SITES.map(site => {
      const offer = offers[site.code];
      const siteCategories = categories.filter(category => {
        const storefronts = category.config?.storefronts;
        return !Array.isArray(storefronts) || storefronts.length === 0 || storefronts.includes(site.code);
      });
      return <section key={site.code} className={`space-y-4 rounded-xl border p-5 ${site.code === 'loja_3d' ? 'border-violet-200 bg-violet-50' : 'bg-white'}`}><div className="flex items-center justify-between gap-3"><h2 className={`text-lg font-bold ${site.code === 'loja_3d' ? 'text-violet-900' : ''}`}>{site.label}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{offer.publication_status}</span></div>
        <div className="rounded-lg border border-violet-200 bg-white/80 p-3 text-sm text-slate-700"><strong>Como preencher</strong><p className="mt-1">A descrição exibida vem do cadastro central do produto. Nesta tela, altere somente o que pode ser diferente no {site.label}.</p><p className="mt-1">Para publicar, revise obrigatoriamente <strong>visibilidade, categoria e preço de venda</strong>. Revenda, atacado, promoção, endereço e dados de busca são opcionais.</p></div>
        <label className="block text-sm font-medium">Visibilidade<select value={offer.publication_status} onChange={event => change(site.code, { publication_status: event.target.value as StorefrontOffer['publication_status'] })} className={fieldClass}><option value="draft">Rascunho — salvar sem mostrar no site</option><option value="published">Publicado — mostrar para os clientes</option><option value="hidden">Oculto — retirar do site sem apagar</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Use Rascunho enquanto estiver preenchendo. Escolha Publicado somente depois de revisar os campos.</span></label>
        <label className="block text-sm font-medium">Nome exibido neste site<input value={offer.title || ''} onChange={event => change(site.code, { title: event.target.value || null })} className={fieldClass} placeholder="Informe o nome que o cliente verá" /><span className="mt-1 block text-xs font-normal text-slate-500">Copiado do produto central. Pode ser adaptado para este site.</span></label>
        <div className="text-sm font-medium">
          <label htmlFor={`storefront-category-${site.code}`}>Categoria neste site</label>
          <select id={`storefront-category-${site.code}`} value={offer.category_label || ''} onChange={event => change(site.code, { category_label: event.target.value || null })} className={fieldClass} disabled={categoriesLoading} aria-required={offer.publication_status === 'published'}>
            <option value="">{categoriesLoading ? 'Carregando categorias...' : 'Selecione antes de publicar'}</option>
            {offer.category_label && !siteCategories.some(category => category.name === offer.category_label) && <option value={offer.category_label}>{offer.category_label} (categoria já salva)</option>}
            {siteCategories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">Copiada da categoria central quando existe. A escolha vale somente para o {site.label}; o outro site pode usar outra categoria.</span>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-normal">
            {site.code === 'loja_3d' && <button type="button" onClick={() => { setCreatingCategoryFor(site.code); setNewCategoryName(''); setError(''); }} className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100">+ Criar categoria da Loja 3D</button>}
            <Link to="/admin/settings/categories" className="text-xs text-blue-700 hover:underline">Gerenciar todas as categorias</Link>
          </div>
          {creatingCategoryFor === site.code && <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3 font-normal">
            <label htmlFor={`new-storefront-category-${site.code}`} className="block text-xs font-semibold text-slate-700">Nome da nova categoria</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input id={`new-storefront-category-${site.code}`} autoFocus value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void createStorefrontCategory(site.code); } }} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Decoração 3D" disabled={creatingCategory} />
              <button type="button" onClick={() => void createStorefrontCategory(site.code)} disabled={creatingCategory || !newCategoryName.trim()} className="rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{creatingCategory ? 'Criando...' : 'Criar e selecionar'}</button>
              <button type="button" onClick={() => { setCreatingCategoryFor(null); setNewCategoryName(''); }} disabled={creatingCategory} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">A nova categoria ficará disponível na seleção da Loja 3D. Depois, salve esta oferta ou publique a família.</p>
          </div>}
        </div>
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
