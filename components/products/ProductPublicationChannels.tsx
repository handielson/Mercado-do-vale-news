import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types/product';
import { productStorefrontOffersService, type StorefrontOffer } from '../../services/productStorefrontOffers';
import { mercadoLivreService } from '../../services/mercadoLivreService';

// Cards mounted together share a single read of the existing marketplace links endpoint.
let pendingLinks: ReturnType<typeof mercadoLivreService.getProductLinks> | null = null;
function loadLinks() {
  if (!pendingLinks) pendingLinks = mercadoLivreService.getProductLinks().finally(() => { pendingLinks = null; });
  return pendingLinks;
}

export function ProductPublicationChannels({ product, shopeeLinked, tiktokStatus, onShopee, onTikTok }: {
  product: Product; shopeeLinked: boolean; tiktokStatus: string; onShopee: (event: MouseEvent) => void; onTikTok: () => void;
}) {
  const [offers, setOffers] = useState<StorefrontOffer[] | null>(null);
  const [ml, setMl] = useState<Array<{ item_id: string; variation_id?: string; last_error?: string | null }> | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setOffers(null); setMl(null); setFailed(false);
    void Promise.allSettled([productStorefrontOffersService.list(product.id), loadLinks()]).then(([sites, marketplace]) => {
      if (!active) return;
      if (sites.status === 'fulfilled') setOffers(sites.value.offers);
      if (marketplace.status === 'fulfilled') setMl(marketplace.value.items.filter(item => item.product_id === product.id));
      setFailed(sites.status === 'rejected' || marketplace.status === 'rejected');
    });
    return () => { active = false; };
  }, [product.id, refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  const offer3d = offers?.find(offer => offer.storefront === 'loja_3d');
  const status3d = offers === null ? (failed ? 'Não consultado' : 'Consultando…') : !offer3d ? 'Não publicado'
    : offer3d.publication_status === 'published'
      ? product.status === 'active' && !product.is_parent && product.is_print3d && Number(offer3d.price_retail) > 0 ? 'Publicado' : 'Publicação bloqueada pelo cadastro'
      : offer3d.publication_status === 'hidden' ? 'Oculto' : 'Rascunho';
  const mlStatus = ml === null ? (failed ? 'Não consultado' : 'Consultando…') : ml.length ? 'Vinculado' : 'Sem vínculo';
  return <div className="mt-3 space-y-2 border-t border-slate-100 pt-3" onClick={event => event.stopPropagation()}>
    <Link className="inline-flex rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800" to={`/admin/loja-3d/catalogo?sku=${encodeURIComponent(product.sku || '')}`}>Publicar / gerenciar na Loja 3D</Link>
    <div className="flex flex-wrap gap-1 text-[10px]">
      <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">Mercado do Vale: {product.hide_from_catalog ? 'Oculto no cadastro' : 'Catálogo atual'}</span>
      <span className="rounded bg-violet-100 px-2 py-1 text-violet-800">Loja 3D: {status3d}</span>
      <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-900">Mercado Livre: {mlStatus}</span>
      {shopeeLinked && <span className="rounded bg-orange-100 px-2 py-1 text-orange-900">Shopee: vinculado</span>}
      {tiktokStatus && <span className="rounded bg-slate-100 px-2 py-1">TikTok: {['ACTIVE', 'ACTIVATE'].includes(tiktokStatus) ? 'Publicado' : tiktokStatus === 'PENDING' ? 'Em análise' : tiktokStatus}</span>}
    </div>
    <details className="text-xs"><summary className="cursor-pointer font-semibold text-slate-700">Publicações e canais de venda</summary>
      <ul className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
        <li><strong>Mercado do Vale</strong><p>{product.hide_from_catalog ? 'Oculto no cadastro' : 'Visibilidade controlada pelo catálogo atual'}</p><Link className="text-blue-700 underline" to={`/admin/products/${product.id}`}>Gerenciar cadastro e visibilidade</Link></li>
        <li><strong>Loja 3D — {status3d}</strong><p>Preço e visibilidade próprios, configurados por SKU.</p></li>
        <li><strong>Mercado Livre — {mlStatus}</strong>{ml?.map(item => <p key={`${item.item_id}-${item.variation_id}`}>{item.item_id}{item.variation_id ? ` · variação ${item.variation_id}` : ''}{item.last_error ? ' · sincronização requer atenção' : ''}</p>)}<p>Vínculo salvo não confirma anúncio ativo. A criação automática de anúncios ainda não está disponível.</p><Link className="text-blue-700 underline" to={`/admin/settings/mercado-livre?productId=${encodeURIComponent(product.id)}&sku=${encodeURIComponent(product.sku || '')}`}>Gerenciar Mercado Livre</Link></li>
        <li><button type="button" className="text-orange-700 underline" onClick={onShopee}>Gerenciar Shopee{shopeeLinked ? ' · vinculado' : ''}</button></li>
        <li><button type="button" className="text-slate-800 underline" onClick={onTikTok}>Gerenciar TikTok Shop</button></li>
      </ul>
      {failed && <p role="status" className="mt-2 text-amber-800">Não foi possível consultar todos os canais. Isso não significa que o produto não está publicado.</p>}
      <button type="button" className="mt-2 text-blue-700 underline" onClick={() => setRefresh(value => value + 1)}>Atualizar situação dos canais</button>
    </details>
  </div>;
}
