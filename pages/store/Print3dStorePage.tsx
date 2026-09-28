import { useEffect, useMemo, useRef, useState } from 'react';
import { readCheckoutCart, saveCheckoutCart } from '@/services/print3dCheckoutClient';
import Print3dShippingCalculator from './Print3dShippingCalculator';
import { BannerCarousel } from '@/components/catalog/BannerCarousel';
import { bannerService } from '@/services/bannerService';
import type { Banner } from '@/types/catalog';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Clock3, Menu, Play, Search, ShoppingBag, X } from 'lucide-react';
import { vpsApiService } from '@/services/vpsApiService';
import { productStorefrontOffersService } from '@/services/productStorefrontOffers';
import { normalizeCatalogProduct } from '@/services/productNormalizer';
import { formatPrice } from '@/services/installmentCalculator';
import type { CatalogProduct } from '@/types/catalog';
import Print3dCartDrawer, { type Print3dCartLine } from './Print3dCartDrawer';
import { print3dVariantLabel as variantLabel } from '@/utils/print3dVariantLabel.js';
import ProductDeadlineRequest, { productDeadlineLabel } from '@/components/catalog/ProductDeadlineRequest';

type StoreProduct = CatalogProduct & { available_stock?: number; storefront_category?: string | null; previewKind?: 'vase' | 'organizer' | 'keychain' | 'lamp' };
const demoBase = { brand: '3D do Vale', status: 'active' as CatalogProduct['status'], price_cost: 0, price_reseller: 0, price_wholesale: 0, track_inventory: true, images: [], eans: [], warranty_type: 'brand' as const, created: '', updated: '', is_print3d: true };
const demoProducts: StoreProduct[] = [
  { ...demoBase, id: 'preview-vaso', model_id: 'vaso-aura', sku: 'PREV-VASO-AREIA', name: 'Vaso Aura', model: 'Vaso Aura', category_id: 'Decoração', price_retail: 4900, stock_quantity: 4, specs: { material: 'PLA', color: 'Areia' }, previewKind: 'vase' },
  { ...demoBase, id: 'preview-vaso-terracota', model_id: 'vaso-aura', sku: 'PREV-VASO-TERRA', name: 'Vaso Aura', model: 'Vaso Aura', category_id: 'Decoração', price_retail: 5400, stock_quantity: 0, specs: { material: 'PLA', color: 'Terracota' }, print3d_preorder_enabled: true, production_days: 4, previewKind: 'vase' },
  { ...demoBase, id: 'preview-organizador', model_id: 'organizador-modular', sku: 'PREV-ORG', name: 'Organizador Modular', model: 'Organizador Modular', category_id: 'Organização', price_retail: 7900, stock_quantity: 2, specs: { material: 'PETG', color: 'Grafite' }, previewKind: 'organizer' },
  { ...demoBase, id: 'preview-chaveiro', model_id: 'chaveiro-personalizado', sku: 'PREV-CHAV', name: 'Chaveiro Personalizado', model: 'Chaveiro Personalizado', category_id: 'Presentes', price_retail: 1900, stock_quantity: 0, specs: { material: 'PLA', color: 'Terracota' }, print3d_preorder_enabled: true, production_days: 3, previewKind: 'keychain' },
  { ...demoBase, id: 'preview-luminaria', model_id: 'luminaria-orbita', sku: 'PREV-LUZ', name: 'Luminária Órbita', model: 'Luminária Órbita', category_id: 'Decoração', price_retail: 12900, stock_quantity: 1, specs: { material: 'PLA', color: 'Marfim' }, previewKind: 'lamp' },
];
const availableStock = (product: StoreProduct) => Math.max(0, Number(product.available_stock ?? product.stock_quantity) || 0);
const availability = (product: StoreProduct) => availableStock(product) > 0
  ? `${availableStock(product)} em estoque`
  : product.print3d_preorder_enabled ? productDeadlineLabel(product.production_days) : 'Indisponível';
const groupKey = (product: StoreProduct) => String(product.model_id || '').trim() || product.id;
const matchesQuery = (product: StoreProduct, query: string) => `${product.name} ${product.sku} ${variantLabel(product)}`.toLocaleLowerCase('pt-BR').includes(query);

function ProductImage({ product, hero = false }: { product: StoreProduct; hero?: boolean }) {
  const image = product.images?.[0] || product.image_url;
  if (image) return <img src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />;
  const kind = product.previewKind || 'vase';
  return <div className={`flex h-full w-full items-center justify-center overflow-hidden ${kind === 'organizer' ? 'bg-[#e8e8e4]' : kind === 'keychain' ? 'bg-[#ebe5df]' : kind === 'lamp' ? 'bg-[#e9e8e3]' : 'bg-[#eae7e0]'}`}>
    <svg viewBox="0 0 300 320" role="img" aria-label={`Ilustração de ${product.name}`} className={`${hero ? 'w-[66%] max-w-[390px]' : 'w-[65%]'} h-auto drop-shadow-[12px_24px_13px_rgba(27,25,21,.13)]`}>
      <defs><linearGradient id={`surface-${kind}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor={kind === 'organizer' ? '#878c89' : kind === 'keychain' ? '#bd8a72' : '#f3f0e8'} /><stop offset="1" stopColor={kind === 'organizer' ? '#3e4542' : kind === 'keychain' ? '#825e51' : '#a6a293'} /></linearGradient></defs>
      {kind === 'vase' && <><path d="M90 57 Q150 71 210 57 L195 92 C184 128 199 173 211 260 Q150 283 89 260 C101 173 116 128 105 92Z" fill={`url(#surface-${kind})`} /><ellipse cx="150" cy="57" rx="60" ry="15" fill="#d5d1c7" /><ellipse cx="150" cy="56" rx="46" ry="8" fill="#777669" /><path d="M106 112 Q150 128 194 112 M99 150 Q150 170 201 150 M93 190 Q150 212 207 190 M89 233 Q150 256 211 233" fill="none" stroke="#868575" strokeWidth="2" opacity=".3" /></>}
      {kind === 'organizer' && <><path d="M39 105 L156 69 L261 104 L261 240 L151 276 L39 237Z" fill={`url(#surface-${kind})`} /><path d="M39 105 L151 143 L261 104 M151 143 L151 276" fill="none" stroke="#afb4af" strokeWidth="3" /><path d="M58 107 L157 82 L239 106 L150 132Z" fill="#323936" /></>}
      {kind === 'keychain' && <><circle cx="150" cy="68" r="30" fill="none" stroke="#a7a8a3" strokeWidth="10" /><path d="M150 97 L150 111" stroke="#a7a8a3" strokeWidth="9" /><rect x="66" y="109" width="168" height="137" rx="39" fill={`url(#surface-${kind})`} /><rect x="81" y="124" width="138" height="107" rx="28" fill="none" stroke="#d9b9aa" strokeWidth="2" /><path d="M100 181 L128 153 L148 174 L193 139" fill="none" stroke="#f0e1d3" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" /></>}
      {kind === 'lamp' && <><path d="M132 226 L168 226 L176 278 L124 278Z" fill="#757e78" /><circle cx="150" cy="144" r="90" fill={`url(#surface-${kind})`} /><ellipse cx="150" cy="144" rx="62" ry="89" fill="none" stroke="#b8b6a9" strokeWidth="3" /><ellipse cx="150" cy="144" rx="89" ry="38" fill="none" stroke="#b8b6a9" strokeWidth="3" /><circle cx="135" cy="123" r="24" fill="#fffae6" opacity=".7" /></>}
    </svg>
  </div>;
}

export default function Print3dStorePage() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLines, setCartLines] = useState<Print3dCartLine[]>([]);
  const cartRestored = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (params.get('demo') === '1') { setLoading(false); return; }
    let active = true;
    vpsApiService.getCategories().then(rows => { if (active) setCategoryNames(Object.fromEntries((rows || []).map((row: { id: string; name: string }) => [String(row.id), row.name]))); }).catch(() => undefined);
    productStorefrontOffersService.publicProducts('loja_3d').then(rows => { if (active) setProducts((rows || []).map(row => normalizeCatalogProduct(row))); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const preview = params.get('demo') === '1' || (!loading && !error && products.length === 0);
  const items = preview ? demoProducts : products;
  useEffect(() => {
    if (preview || loading || error || cartRestored.current) return;
    cartRestored.current = true;
    setCartLines(readCheckoutCart().flatMap(line => {
      const product = products.find(item => item.id === line.product_id);
      return product ? [{ product, quantity: line.quantity }] : [];
    }));
  }, [preview, loading, error, products]);
  useEffect(() => {
    if (preview || !cartRestored.current) return;
    try { saveCheckoutCart(cartLines.map(line => ({ product_id: line.product.id, quantity: line.quantity }))); } catch { /* The cart remains usable in memory. */ }
  }, [cartLines, preview]);
  useEffect(() => {
    let active = true;
    setBanners([]);
    if (!preview && !loading) bannerService.getActiveBanners(undefined, 'loja_3d')
      .then(data => { if (active) { setBanners(data); data.forEach(banner => { void bannerService.trackBannerView(banner.id).catch(() => {}); }); } })
      .catch(() => {});
    return () => { active = false; };
  }, [preview, loading]);
  useEffect(() => {
    const productId = params.get('produto');
    if (productId) setSelected(items.find(product => product.id === productId || product.slug === productId) || null);
    const destination = params.get('categoria');
    if (destination) {
      const match = items.find(product => String(product.category_id) === destination || product.storefront_category === destination || categoryNames[String(product.category_id)] === destination);
      setCategory(match ? match.storefront_category || categoryNames[String(match.category_id)] || String(match.category_id) : destination);
    }
  }, [params, items, categoryNames]);
  const categoryOf = (product: StoreProduct) => product.storefront_category || categoryNames[String(product.category_id)] || String(product.category_id || 'Outros');
  const categories = useMemo(() => ['Todos', ...new Set(items.map(categoryOf))], [items, categoryNames]);
  const variantGroups = useMemo(() => {
    const groups = new Map<string, StoreProduct[]>();
    for (const product of items) groups.set(groupKey(product), [...(groups.get(groupKey(product)) || []), product]);
    return groups;
  }, [items]);
  const filtered = useMemo(() => [...variantGroups.values()].filter(group =>
    (category === 'Todos' || group.some(product => categoryOf(product) === category))
    && group.some(product => matchesQuery(product, query.trim().toLocaleLowerCase('pt-BR')))
  ).map(group => {
    const matching = group.filter(product => matchesQuery(product, query.trim().toLocaleLowerCase('pt-BR')));
    return matching.find(product => availableStock(product) > 0)
      || matching.find(product => product.print3d_preorder_enabled)
      || matching[0];
  }), [variantGroups, category, query, categoryNames]);
  const selectedVariants = selected ? variantGroups.get(groupKey(selected)) || [selected] : [];
  const featured = items[0] || demoProducts[0];
  const addToCart = (product: StoreProduct) => {
    setCartLines(current => {
      const existing = current.find(line => line.product.id === product.id);
      return existing ? current.map(line => line.product.id === product.id ? { ...line, quantity: Math.min(1000, line.quantity + 1) } : line)
        : [...current, { product, quantity: 1 }];
    });
    setSelected(null);
    setCartOpen(true);
  };
  const updateCartQuantity = (id: string, quantity: number) => setCartLines(current => quantity < 1
    ? current.filter(line => line.product.id !== id)
    : current.map(line => line.product.id === id
      ? { ...line, quantity: Math.min(1000, Math.max(1, availableStock(line.product)), quantity) } : line));

  return <div className="min-h-screen bg-[var(--print3d-surface)] text-[#1c2220]">
    <Helmet><title>3D do Vale — Impressão 3D para o seu dia a dia</title><meta name="description" content="Peças de impressão 3D para decoração, organização e presentes." /><meta name="robots" content="noindex, nofollow" /></Helmet>
    <header className="border-b border-[#deded8] bg-white"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-9 lg:px-12"><Link to="/loja-3d" className="shrink-0 text-[22px] font-bold tracking-[-.07em]">3D <span className="font-normal">do Vale</span><span className="text-[var(--print3d-accent)]">.</span></Link><label className="hidden max-w-md flex-1 items-center gap-3 rounded-lg border border-[#deded8] bg-[var(--print3d-surface)] px-4 py-2.5 text-[#747b75] md:flex"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar peças, materiais, cores..." aria-label="Buscar produtos 3D" className="w-full bg-transparent text-sm text-[#1c2220] outline-none" /></label><nav className="hidden items-center gap-7 text-sm font-medium lg:flex"><a href="#colecao">Produtos</a><a href="#processo">Como funciona</a><Link to={preview ? '/loja-3d/conta?demo=1' : '/loja-3d/conta'}>Minha conta</Link><Link to="/" className="text-[#747b75]">Mercado do Vale <ArrowUpRight size={14} className="inline" /></Link></nav><button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)} className="p-2 lg:hidden"><Menu size={23} /></button></div>{menuOpen && <nav className="flex flex-col gap-4 border-t border-[#deded8] px-5 py-5 text-sm lg:hidden"><a href="#colecao" onClick={() => setMenuOpen(false)}>Produtos</a><a href="#processo" onClick={() => setMenuOpen(false)}>Como funciona</a><Link to={preview ? '/loja-3d/conta?demo=1' : '/loja-3d/conta'} onClick={() => setMenuOpen(false)}>Minha conta</Link><Link to="/">Mercado do Vale</Link></nav>}</header>
    <main>
      <div className="border-b border-[#deded8] bg-[#f3f1ec]"><div className="mx-auto flex max-w-[1440px] items-center justify-center gap-x-12 gap-y-1 px-5 py-2.5 text-xs font-medium text-[#5e655f]"><span>Peças prontas e sob encomenda</span><span className="hidden sm:inline">Fotos, vídeo e detalhes de cada peça</span><span className="hidden lg:inline">Estoque integrado ao Mercado do Vale</span></div></div>
      {banners.length > 0 ? <section aria-label="Ofertas da loja 3D" className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6"><BannerCarousel banners={banners} storefront="loja_3d" /></section> : <section className="mx-auto grid max-w-[1440px] overflow-hidden border-b border-[#deded8] bg-[#ede9e1] md:grid-cols-[1fr_44%]"><div className="flex flex-col justify-center px-5 py-8 sm:px-9 md:py-14 lg:px-12"><span className="text-xs font-bold uppercase tracking-[.16em] text-[#986d51]">Impressão 3D para o dia a dia</span><h1 className="mt-3 max-w-[630px] text-3xl font-semibold leading-[1.06] tracking-tighter sm:text-5xl lg:text-6xl">Peças únicas para usar, decorar e presentear.</h1><p className="mt-3 max-w-[440px] text-sm leading-relaxed text-[#626a63] sm:mt-5 sm:text-base">Escolha seu produto, confira materiais, cores e disponibilidade.</p><a href="#colecao" className="mt-5 inline-flex w-fit items-center gap-3 rounded-md bg-[var(--print3d-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--print3d-accent-hover)] sm:mt-7">Ver produtos <ArrowRight size={17} /></a></div><div className="relative hidden h-[410px] overflow-hidden md:block"><ProductImage product={featured} hero /><span className="absolute bottom-3 left-4 bg-white px-3 py-1.5 text-xs font-medium">{preview ? 'Imagem ilustrativa' : featured.name}</span></div></section>}
      <section id="colecao" className="mx-auto max-w-[1440px] scroll-mt-8 px-5 py-9 sm:px-9 lg:px-12 lg:py-16"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-[.15em] text-[#69716c]">Catálogo</span><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Nossos produtos</h2></div><span className="text-sm text-[#69716c]">{filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</span></div>{preview && <p className="mt-6 border-l-2 border-[#85765e] bg-[#f1eee7] px-4 py-3 text-sm text-[#554f45]"><strong>Prévia visual.</strong> Produtos, preços e disponibilidade são exemplos. Nenhuma compra pode ser feita aqui.</p>}
        <div className="mt-12 flex flex-col gap-6 border-y border-[#deded8] py-5 md:flex-row md:items-center md:justify-between"><div className="flex gap-7 overflow-x-auto pb-1">{categories.map(name => <button key={name} type="button" onClick={() => setCategory(name)} className={`shrink-0 border-b pb-1 text-sm transition ${category === name ? 'border-[#1c2220] font-semibold text-[#1c2220]' : 'border-transparent text-[#78817a] hover:text-[#1c2220]'}`}>{name}</button>)}</div><label className="flex w-full items-center gap-3 border-b border-[#bfc4bd] pb-2 text-[#69716c] md:w-56"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" className="w-full bg-transparent text-sm text-[#1c2220] outline-none placeholder:text-[#8b938c]" /></label></div>
        {loading && <div className="mt-8 grid gap-x-5 gap-y-11 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(index => <div key={index} className="animate-pulse"><div className="aspect-[4/5] bg-[#eae8e1]" /><div className="mt-4 h-4 w-2/3 bg-[#eae8e1]" /></div>)}</div>}
        {!loading && error && !preview && <div role="alert" className="mt-10 border border-[#deded8] p-8 text-sm"><p>Não foi possível carregar os produtos.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 underline">Tentar novamente</button><button type="button" onClick={() => setParams({ demo: '1' })} className="ml-6 underline">Ver prévia visual</button></div>}
        {!loading && (!error || preview) && filtered.length === 0 && <div className="py-20 text-center text-[#69716c]">Nenhuma peça encontrada para esta busca.</div>}
        {!loading && (!error || preview) && filtered.length > 0 && <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{filtered.map(product => <article key={product.id} className="group overflow-hidden rounded-lg border border-[#e4e4de] bg-white"><button type="button" onClick={() => setSelected(product)} className="relative block aspect-square w-full overflow-hidden text-left"><ProductImage product={product} /><span className="absolute left-2 top-2 rounded-sm bg-white/95 px-2 py-1 text-[10px] font-semibold sm:left-3 sm:top-3 sm:px-2.5 sm:py-1.5 sm:text-[11px]">{availableStock(product) > 0 ? 'Pronta entrega' : product.print3d_preorder_enabled ? 'Sob encomenda' : 'Indisponível'}</span></button><div className="p-3 sm:p-4"><span className="text-xs text-[#78817a]">{variantGroups.get(groupKey(product))?.length === 1 ? variantLabel(product) : `${variantGroups.get(groupKey(product))?.length} variações disponíveis`}</span><h3 className="mt-2 min-h-12 text-sm font-semibold leading-tight sm:text-base">{product.name}</h3><p className="mt-1 text-xs text-[#69716c]">{availability(product)}</p><strong className="mt-3 block text-lg font-bold tracking-tight sm:mt-4 sm:text-xl">{variantGroups.get(groupKey(product))?.length > 1 && <span className="mr-1 text-xs font-normal text-[#69716c]">A partir de</span>}{formatPrice(Math.min(...(variantGroups.get(groupKey(product)) || [product]).map(variant => variant.price_retail)))}</strong><button type="button" onClick={() => setSelected(product)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#1c2220] px-2 py-2.5 text-xs font-semibold transition hover:bg-[var(--print3d-accent)] hover:text-white sm:mt-4 sm:text-sm">Ver produto <ArrowRight size={15} /></button></div></article>)}</div>}
      </section>
      <section id="processo" className="border-t border-[#deded8] bg-[#f1f0eb]"><div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-9 lg:grid-cols-2 lg:px-12 lg:py-28"><div><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#69716c]">Nosso processo</span><h2 className="mt-5 max-w-lg text-4xl font-medium leading-[1.1] tracking-[-.07em] sm:text-5xl">Pensado nos detalhes. Feito camada por camada.</h2></div><div className="divide-y divide-[#cfd2cb] border-t border-[#cfd2cb]">{[['01', 'Escolha sua peça', 'Veja materiais, cores e características de cada criação.'], ['02', 'Consulte a quantidade', 'Para encomendas, envie a quantidade desejada e combine o prazo com a equipe.'], ['03', 'Acompanhe cada etapa', 'Depois da confirmação, acompanhe a produção até a conferência final.']].map(([number, title, description]) => <div key={number} className="flex gap-8 py-6"><span className="text-xs text-[#69716c]">{number}</span><div><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#69716c]">{description}</p></div></div>)}</div></div></section>
    </main>
    <button type="button" onClick={() => setCartOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg" aria-label="Abrir carrinho"><ShoppingBag size={19} /> Carrinho{cartLines.length ? " (" + cartLines.reduce((sum, line) => sum + line.quantity, 0) + ")" : ''}</button>
    <footer className="border-t border-[#deded8] px-5 py-8 sm:px-9 lg:px-12"><div className="mx-auto flex max-w-[1344px] flex-wrap items-center justify-between gap-4 text-sm"><strong className="text-lg tracking-[-.06em]">3D do Vale</strong><span className="text-[#78817a]">Uma criação do Mercado do Vale.</span><Link to="/" className="inline-flex items-center gap-1 hover:underline">Mercado do Vale <ArrowUpRight size={14} /></Link></div></footer>
    {cartOpen && <Print3dCartDrawer lines={cartLines} preview={preview} onQuantity={updateCartQuantity} onClose={() => setCartOpen(false)} />}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171d1a]/70 p-3 sm:p-6" onClick={() => setSelected(null)} role="presentation"><section role="dialog" aria-modal="true" aria-label={selected.name} onClick={event => event.stopPropagation()} className="relative grid max-h-[92vh] w-full max-w-4xl overflow-y-auto bg-[var(--print3d-surface)] shadow-2xl md:grid-cols-2"><button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes" className="absolute right-4 top-4 z-10 bg-[var(--print3d-surface)] p-2"><X size={20} /></button><div className="aspect-square overflow-hidden md:h-full"><ProductImage product={selected} hero /></div><div className="flex flex-col p-7 sm:p-10"><span className="text-xs uppercase tracking-[.15em] text-[#78817a]">SKU {selected.sku}</span><h2 className="mt-4 text-3xl font-medium tracking-[-.055em]">{selected.name}</h2><p className="mt-4 text-sm leading-relaxed text-[#69716c]">{selected.description || 'Peça criada por impressão 3D, com atenção a cada detalhe.'}</p><div className="mt-8 divide-y divide-[#deded8] border-y border-[#deded8] text-sm">{Object.entries(selected.specs || {}).filter(([, value]) => ['string', 'number'].includes(typeof value)).slice(0, 5).map(([key, value]) => <div key={key} className="flex justify-between gap-5 py-3"><span className="capitalize text-[#78817a]">{key}</span><span>{String(value)}</span></div>)}</div><p className="mt-7 flex items-center gap-2 text-sm"><Clock3 size={16} /> {availability(selected)}</p><p className="mt-2 text-xs leading-relaxed text-[#69716c]">Peças prontas podem ser compradas normalmente. Encomendas são analisadas conforme a quantidade antes da confirmação do pedido e da cobrança.</p>{selectedVariants.length > 1 && <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#69716c]">Escolha sua variação</p><div className="mt-3 grid gap-2">{selectedVariants.map(variant => <button key={variant.id} type="button" onClick={() => setSelected(variant)} aria-pressed={selected.id === variant.id} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${selected.id === variant.id ? 'border-[#1c2220] bg-white' : 'border-[#deded8] hover:border-[#8b938c]'}`}><span><span className="block font-medium">{variantLabel(variant)}</span><span className="text-xs text-[#69716c]">{availability(variant)} · SKU {variant.sku}</span></span><strong className="whitespace-nowrap">{formatPrice(variant.price_retail)}</strong></button>)}</div></div>}<strong className="mt-8 text-3xl font-medium tracking-[-.05em]">{formatPrice(selected.price_retail)}</strong>{selected.video_url && <a href={selected.video_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm underline underline-offset-4"><Play size={16} /> Assistir vídeo</a>}{availableStock(selected) > 0 && <Print3dShippingCalculator key={selected.id} items={[{ product_id: selected.id, quantity: 1 }]} preview={preview} />}{selected.print3d_preorder_enabled && !preview && <ProductDeadlineRequest storefront="loja_3d" product={selected} initialQuantity={Math.max(1, availableStock(selected) + 1)} />}<button type="button" onClick={() => addToCart(selected)} disabled={availableStock(selected) <= 0} className="mt-7 rounded-md bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#cbd0c9]">{availableStock(selected) > 0 ? 'Adicionar peça pronta ao carrinho' : 'Sem peça pronta em estoque'}</button><p className="mt-3 text-xs leading-relaxed text-[#78817a]">{preview ? 'Simulação visual: compra indisponível.' : 'Preço, disponibilidade e entrega são conferidos na finalização.'}</p></div></section></div>}
  </div>;
}
