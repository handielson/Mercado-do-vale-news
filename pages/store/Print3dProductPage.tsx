import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, Menu, Package, Play, Share2, ShoppingBag } from 'lucide-react';
import { productStorefrontOffersService } from '@/services/productStorefrontOffers';
import { normalizeCatalogProduct } from '@/services/productNormalizer';
import { formatPrice } from '@/services/installmentCalculator';
import { readCheckoutCart, saveCheckoutCart } from '@/services/print3dCheckoutClient';
import { print3dVariantLabel } from '@/utils/print3dVariantLabel.js';
import ProductDeadlineRequest from '@/components/catalog/ProductDeadlineRequest';
import Print3dShippingCalculator from './Print3dShippingCalculator';
import Print3dCartDrawer, { type Print3dCartLine } from './Print3dCartDrawer';
import {
  print3dAvailability,
  print3dAvailableStock,
  print3dBaseProductName,
  print3dDemoProducts,
  print3dGroupKey,
  print3dLegacyProductRouteTarget,
  print3dPlainText,
  print3dProductPath,
  print3dProductRouteTarget,
  type Print3dStoreProduct,
} from '@/utils/print3dStorefront';
import { syncDocumentSeo } from '@/utils/documentSeo';

const SPEC_LABELS: Record<string, string> = {
  material: 'Material', color: 'Cor', cor: 'Cor', size: 'Tamanho', tamanho: 'Tamanho',
  finish: 'Acabamento', acabamento: 'Acabamento', weight_kg: 'Peso',
  'dimensions.height_cm': 'Altura', 'dimensions.width_cm': 'Largura', 'dimensions.depth_cm': 'Profundidade',
};
const HIDDEN_SPECS = new Set(['slug', 'keywords', 'meta_title', 'meta_description', 'tags_venda']);

function Print3dProductSeo({ title, description, robots, canonical, image, price, schema }: {
  title: string; description: string; robots: string; canonical: string; image: string; price: string; schema: object;
}) {
  useEffect(() => {
    const seo = {
      description, robots, canonical,
      openGraph: { 'og:type': 'product', 'og:site_name': '3DMV', 'og:title': title, 'og:description': description, 'og:url': canonical, ...(image ? { 'og:image': image } : {}), 'product:price:amount': price, 'product:price:currency': 'BRL' },
      twitter: { 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, ...(image ? { 'twitter:image': image } : {}) },
    };
    const apply = () => syncDocumentSeo(seo);
    apply();
    const frame = window.requestAnimationFrame(apply);
    const timeout = window.setTimeout(apply, 100);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timeout); };
  }, [title, description, robots, canonical, image, price]);

  return <Helmet>
    <title>{title}</title><meta name="description" content={description} /><meta name="robots" content={robots} /><link rel="canonical" href={canonical} />
    <meta property="og:type" content="product" /><meta property="og:site_name" content="3DMV" /><meta property="og:title" content={title} /><meta property="og:description" content={description} /><meta property="og:url" content={canonical} />
    {image && <meta property="og:image" content={image} />}<meta property="product:price:amount" content={price} /><meta property="product:price:currency" content="BRL" />
    <meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content={title} /><meta name="twitter:description" content={description} />{image && <meta name="twitter:image" content={image} />}
    <script type="application/ld+json">{JSON.stringify(schema)}</script>
  </Helmet>;
}

function specValue(key: string, value: unknown): string {
  if (key === 'weight_kg') return `${Number(value).toLocaleString('pt-BR')} kg`;
  if (key.startsWith('dimensions.')) return `${Number(value).toLocaleString('pt-BR')} cm`;
  return String(value);
}

export default function Print3dProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const demo = params.get('demo') === '1';
  const [products, setProducts] = useState<Print3dStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartLines, setCartLines] = useState<Print3dCartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (demo) {
      setProducts(print3dDemoProducts);
      setLoading(false);
      return () => { active = false; };
    }
    productStorefrontOffersService.publicProducts('loja_3d')
      .then(rows => { if (active) setProducts((rows || []).map(row => normalizeCatalogProduct(row))); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo]);

  const routeProduct = useMemo(() => products.find(item => {
    const family = products.filter(candidate => print3dGroupKey(candidate) === print3dGroupKey(item));
    return print3dProductRouteTarget(item, family) === slug || print3dLegacyProductRouteTarget(item) === slug
      || item.id === slug || item.sku === slug || item.slug === slug;
  }) || null, [products, slug]);
  const variants = useMemo(() => routeProduct
    ? products.filter(item => print3dGroupKey(item) === print3dGroupKey(routeProduct))
    : [], [products, routeProduct]);
  const requestedVariant = params.get('variante');
  const product = useMemo(() => variants.find(item => item.sku === requestedVariant || item.id === requestedVariant)
    || routeProduct, [variants, routeProduct, requestedVariant]);
  const images = useMemo(() => product
    ? [...new Set([...(product.images || []), product.image_url].filter((value): value is string => Boolean(value)))]
    : [], [product]);
  const description = print3dPlainText(product?.description) || 'Peça produzida por impressão 3D com atenção aos detalhes.';
  const specifications = useMemo(() => Object.entries(product?.specs || {})
    .filter(([key, value]) => !key.startsWith('_') && !HIDDEN_SPECS.has(key) && (typeof value === 'string' || typeof value === 'number') && String(value).trim())
    .slice(0, 12), [product]);

  useEffect(() => {
    if (!product) return;
    const canonicalTarget = print3dProductRouteTarget(product, variants);
    if (slug !== canonicalTarget) navigate(print3dProductPath(product, demo, variants, true), { replace: true });
    setSelectedImage(0);
    setQuantity(1);
  }, [product?.id, slug, demo, navigate, variants]);

  useEffect(() => {
    if (!products.length || demo) return;
    setCartLines(readCheckoutCart().flatMap(line => {
      const item = products.find(candidate => candidate.id === line.product_id);
      return item ? [{ product: item, quantity: line.quantity }] : [];
    }));
  }, [products, demo]);

  useEffect(() => {
    if (demo || loading) return;
    saveCheckoutCart(cartLines.map(line => ({ product_id: line.product.id, quantity: line.quantity })));
  }, [cartLines, demo, loading]);

  const updateCartQuantity = (id: string, nextQuantity: number) => setCartLines(current => nextQuantity < 1
    ? current.filter(line => line.product.id !== id)
    : current.map(line => line.product.id === id
      ? { ...line, quantity: Math.min(1000, Math.max(1, print3dAvailableStock(line.product)), nextQuantity) }
      : line));

  const addToCart = () => {
    if (!product || print3dAvailableStock(product) <= 0) return;
    setCartLines(current => {
      const existing = current.find(line => line.product.id === product.id);
      const next = Math.min(print3dAvailableStock(product), 1000, (existing?.quantity || 0) + quantity);
      return existing
        ? current.map(line => line.product.id === product.id ? { ...line, quantity: next } : line)
        : [...current, { product, quantity: Math.min(quantity, print3dAvailableStock(product)) }];
    });
    setCartOpen(true);
  };

  const share = async () => {
    if (!product) return;
    try {
      if (navigator.share) await navigator.share({ title: print3dBaseProductName(product), text: product.meta_description || description.slice(0, 150), url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* O usuário pode cancelar o compartilhamento. */ }
  };

  if (loading) return <div className="min-h-screen bg-[var(--print3d-surface)] px-5 py-20 text-center text-sm text-[#69716c]">Carregando produto...</div>;

  if (error || !product) return <main className="min-h-screen bg-[var(--print3d-surface)] px-5 py-20 text-[#1c2220]">
    <Helmet><title>Produto não encontrado | 3DMV</title><meta name="robots" content="noindex, follow" /></Helmet>
    <div className="mx-auto max-w-xl text-center"><Package className="mx-auto text-[#78817a]" size={42} /><h1 className="mt-5 text-3xl font-semibold">Produto não encontrado</h1><p className="mt-3 text-sm text-[#69716c]">Este produto não está publicado ou o endereço não existe.</p><Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white"><ArrowLeft size={16} /> Voltar ao catálogo</Link></div>
  </main>;

  const stock = print3dAvailableStock(product);
  const category = product.storefront_category || product.category_name || 'Impressão 3D';
  const productName = print3dBaseProductName(product);
  const siteOrigin = String(import.meta.env.VITE_PRINT3D_PUBLIC_ORIGIN || window.location.origin).replace(/\/$/, '');
  const canonical = `${siteOrigin}${print3dProductPath(product, false, variants)}`;
  const cleanMetaTitle = print3dBaseProductName({ name: product.meta_title || '' });
  const title = String(cleanMetaTitle ? `${cleanMetaTitle} | 3DMV` : `${productName} | 3DMV`).slice(0, 65);
  const metaDescription = String(product.meta_description || description).slice(0, 160);
  const primaryImage = images[0] || '';
  const availabilityUrl = stock > 0 ? 'https://schema.org/InStock' : product.print3d_preorder_enabled ? 'https://schema.org/PreOrder' : 'https://schema.org/OutOfStock';
  const schema = {
    '@context': 'https://schema.org', '@type': 'Product', name: productName, description: metaDescription,
    sku: product.sku, image: images, category, brand: { '@type': 'Brand', name: product.brand || '3DMV' },
    offers: { '@type': 'Offer', url: canonical, priceCurrency: 'BRL', price: (Number(product.price_retail) / 100).toFixed(2), availability: availabilityUrl, itemCondition: 'https://schema.org/NewCondition' },
  };
  const robots = demo ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const price = (Number(product.price_retail) / 100).toFixed(2);

  return <div className="min-h-screen bg-[var(--print3d-surface)] text-[#1c2220]">
    <Print3dProductSeo title={title} description={metaDescription} robots={robots} canonical={canonical} image={primaryImage} price={price} schema={schema} />

    <header className="border-b border-[#deded8] bg-white"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-9 lg:px-12"><Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="text-[22px] font-bold tracking-[-.07em]">3DMV<span className="text-[var(--print3d-accent)]">.</span></Link><nav className="hidden items-center gap-7 text-sm font-medium lg:flex"><Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'}>Produtos</Link><Link to={demo ? '/loja-3d/conta?demo=1' : '/loja-3d/conta'}>Minha conta</Link><a href="https://www.mercadodovale.com.br/" className="text-[#747b75]">Mercado do Vale <ArrowUpRight size={14} className="inline" /></a></nav><button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)} className="p-2 lg:hidden"><Menu size={23} /></button></div>{menuOpen && <nav className="flex flex-col gap-4 border-t border-[#deded8] px-5 py-5 text-sm lg:hidden"><Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'}>Produtos</Link><Link to={demo ? '/loja-3d/conta?demo=1' : '/loja-3d/conta'}>Minha conta</Link><a href="https://www.mercadodovale.com.br/">Mercado do Vale</a></nav>}</header>

    <main>
      <nav aria-label="Navegação estrutural" className="mx-auto flex max-w-[1344px] items-center gap-2 px-5 py-5 text-xs text-[#69716c] sm:px-9 lg:px-12"><Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="hover:underline">Loja 3D</Link><ChevronRight size={13} /><Link to={`${demo ? '/loja-3d?demo=1&' : '/loja-3d?'}categoria=${encodeURIComponent(category)}`} className="hover:underline">{category}</Link><ChevronRight size={13} /><span className="truncate text-[#1c2220]">{productName}</span></nav>

      <section className="mx-auto grid max-w-[1344px] gap-9 px-5 pb-16 sm:px-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)] lg:gap-14 lg:px-12 lg:pb-24">
        <div><div className="relative aspect-square overflow-hidden rounded-xl border border-[#e2e2dc] bg-white">{images.length ? <img src={images[selectedImage]} alt={`${productName} — ${print3dVariantLabel(product)}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center bg-[#ebe9e3] text-[#8b938c]"><Package size={70} /></div>}{images.length > 1 && <><button type="button" aria-label="Imagem anterior" onClick={() => setSelectedImage(current => (current - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft size={20} /></button><button type="button" aria-label="Próxima imagem" onClick={() => setSelectedImage(current => (current + 1) % images.length)} className="absolute right-3 top-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight size={20} /></button></>}</div>{images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">{images.map((image, index) => <button type="button" key={image} onClick={() => setSelectedImage(index)} aria-label={`Ver imagem ${index + 1}`} className={`aspect-square overflow-hidden rounded-md border bg-white ${index === selectedImage ? 'border-[#1c2220] ring-1 ring-[#1c2220]' : 'border-[#deded8]'}`}><img src={image} alt="" className="h-full w-full object-contain" /></button>)}</div>}{product.video_url && <div className="mt-7 overflow-hidden rounded-xl border border-[#deded8] bg-black"><video controls preload="metadata" className="aspect-video w-full" poster={primaryImage || undefined}><source src={product.video_url} type="video/mp4" /></video><p className="flex items-center gap-2 bg-white px-4 py-3 text-sm"><Play size={16} /> Vídeo do produto</p></div>}</div>

        <div className="lg:pt-3"><div className="flex items-start justify-between gap-4"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#78817a]">{category}</span><button type="button" onClick={() => void share()} className="inline-flex items-center gap-2 text-xs font-semibold text-[#69716c] hover:text-[#1c2220]"><Share2 size={16} /> {copied ? 'Link copiado' : 'Compartilhar'}</button></div><h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-.045em] sm:text-4xl">{productName}</h1><p className="mt-3 text-xs uppercase tracking-[.12em] text-[#78817a]">SKU {product.sku}</p><p className="mt-6 flex items-center gap-2 text-sm font-medium"><Clock3 size={17} /> {print3dAvailability(product)}</p><strong className="mt-6 block text-4xl font-semibold tracking-[-.05em]">{formatPrice(product.price_retail)}</strong><p className="mt-2 text-xs text-[#69716c]">Preço e disponibilidade confirmados na finalização.</p>

          {variants.length > 1 && <div className="mt-8"><h2 className="text-xs font-semibold uppercase tracking-[.13em] text-[#69716c]">Escolha a variação</h2><div className="mt-3 grid gap-2">{variants.map(variant => <Link key={variant.id} to={print3dProductPath(variant, demo, variants, true)} aria-current={variant.id === product.id ? 'page' : undefined} className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${variant.id === product.id ? 'border-[#1c2220] bg-white ring-1 ring-[#1c2220]' : 'border-[#deded8] bg-white/60 hover:border-[#8b938c]'}`}><span><span className="block font-semibold">{print3dVariantLabel(variant)}</span><span className="mt-0.5 block text-xs text-[#69716c]">{print3dAvailability(variant)} · SKU {variant.sku}</span></span><strong>{formatPrice(variant.price_retail)}</strong></Link>)}</div></div>}

          {stock > 0 && <><div className="mt-8 flex items-end gap-3"><label className="text-xs font-semibold text-[#69716c]">Quantidade<select value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="mt-1 block rounded-md border border-[#cbd0c9] bg-white px-3 py-3 text-sm text-[#1c2220]">{Array.from({ length: Math.min(stock, 20) }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label><button type="button" onClick={addToCart} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--print3d-accent-hover)]"><ShoppingBag size={18} /> Adicionar ao carrinho</button></div><Print3dShippingCalculator key={product.id} items={[{ product_id: product.id, quantity }]} preview={demo} /></>}
          {stock <= 0 && <p className="mt-8 rounded-lg border border-[#deded8] bg-[#f1f0eb] p-4 text-sm">Esta variação não possui peça pronta em estoque.</p>}
          {product.print3d_preorder_enabled && !demo && <ProductDeadlineRequest storefront="loja_3d" product={product} />}
          {demo && <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Prévia visual: produto, preço e disponibilidade ilustrativos.</p>}
          <div className="mt-8 grid gap-3 border-y border-[#deded8] py-5 text-sm"><p className="flex items-center gap-3"><Check size={17} className="text-[var(--print3d-accent)]" /> Estoque integrado e conferido no pedido</p><p className="flex items-center gap-3"><Check size={17} className="text-[var(--print3d-accent)]" /> Entrada mínima de 50% para encomendas</p></div>
        </div>
      </section>

      <section className="border-y border-[#deded8] bg-white"><div className="mx-auto grid max-w-[1100px] gap-12 px-5 py-14 sm:px-9 lg:grid-cols-[1.25fr_.75fr] lg:py-20"><div><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#69716c]">Sobre o produto</span><h2 className="mt-3 text-2xl font-semibold tracking-tight">Detalhes e aplicações</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-[#525a54]">{description}</p></div>{specifications.length > 0 && <div><h2 className="text-sm font-semibold">Ficha do produto</h2><dl className="mt-4 divide-y divide-[#deded8] border-y border-[#deded8]">{specifications.map(([key, value]) => <div key={key} className="flex justify-between gap-5 py-3 text-sm"><dt className="text-[#69716c]">{SPEC_LABELS[key] || key.replace(/[._-]+/g, ' ')}</dt><dd className="text-right font-medium">{specValue(key, value)}</dd></div>)}</dl></div>}</div></section>
    </main>

    <button type="button" onClick={() => setCartOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg" aria-label="Abrir carrinho"><ShoppingBag size={19} /> Carrinho{cartLines.length ? ` (${cartLines.reduce((sum, line) => sum + line.quantity, 0)})` : ''}</button>
    <footer className="px-5 py-8 sm:px-9 lg:px-12"><div className="mx-auto flex max-w-[1344px] flex-wrap items-center justify-between gap-4 text-sm"><strong className="text-lg tracking-[-.06em]">3DMV</strong><span className="text-[#78817a]">Uma criação do Mercado do Vale.</span><a href="https://www.mercadodovale.com.br/" className="inline-flex items-center gap-1 hover:underline">Mercado do Vale <ArrowUpRight size={14} /></a></div></footer>
    {cartOpen && <Print3dCartDrawer lines={cartLines} preview={demo} onQuantity={updateCartQuantity} onClose={() => setCartOpen(false)} />}
  </div>;
}
