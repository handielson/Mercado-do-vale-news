import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProductPublicationChannels } from '../components/products/ProductPublicationChannels';
import { productStorefrontOffersService } from '../services/productStorefrontOffers';
import { mercadoLivreService } from '../services/mercadoLivreService';
import type { Product } from '../types/product';
import '../index.css';
import MercadoLivreLinkReview from '../pages/admin/settings/components/MercadoLivreLinkReview';
const params = new URLSearchParams(location.search);
const fail = params.has('fail');
// Isolated fixture: no calls or writes to a real integration.
productStorefrontOffersService.list = async () => {
  if (fail) throw new Error('Fixture offline');
  return { offers: [{ storefront: 'loja_3d', publication_status: 'published', price_retail: 1000 } as any] };
};
mercadoLivreService.getProductLinks = async () => {
  if (fail) throw new Error('Fixture offline');
  return { items: [{ product_id: 'fixture', item_id: 'MLB123456', variation_id: '42' }, { product_id: 'other', item_id: 'MLB999' }] };
};
const product = { id: 'fixture', sku: 'TESTE/3D', status: 'active', is_print3d: true, is_parent: false } as Product;
const candidate = {id:'11111111-1111-4111-8111-111111111111',sku:'AZUL',name:'Peça azul'};
mercadoLivreService.discoverProducts = async cursor => ({sellerId:'7',total:3,nextCursor:cursor?null:'next',errors:[],items:cursor ? [
  {itemId:'MLB3',variationId:'',title:'Anúncio já vinculado',status:'paused',sku:'AZUL',variation:'',match:'linked',candidates:[],existing:[{productId:candidate.id,sku:'AZUL'}]},
] : [
  {itemId:'MLB1',variationId:'1',title:'Peça azul teste',status:'active',sku:'AZUL',variation:'Cor: Azul',match:'unique',candidates:[candidate],existing:[]},
  {itemId:'MLB2',variationId:'',title:'Anúncio sem SKU teste',status:'active',sku:'',variation:'',match:'missing_sku',candidates:[],existing:[]},
]});
mercadoLivreService.findCandidates = async () => ({items:[candidate]});
mercadoLivreService.linkProduct = async input => { if(input.itemId==='MLB2') throw Error('Conflito simulado: vínculo existente preservado.'); return {ok:true}; };
createRoot(document.getElementById('root')!).render(<BrowserRouter><main className="m-6 max-w-4xl rounded-xl border p-4"><h1>Teste local · sem dados reais</h1>{params.has('review') ? <MercadoLivreLinkReview connected /> : <ProductPublicationChannels product={product} shopeeLinked tiktokStatus="PENDING" onShopee={() => {}} onTikTok={() => {}} />}</main></BrowserRouter>);
