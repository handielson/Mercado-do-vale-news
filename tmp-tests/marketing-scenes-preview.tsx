import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import ProductMarketingCard from '../pages/admin/settings/marketing/ProductMarketingCard';
import { buildProductMarketingArtworkData } from '../pages/admin/settings/marketing/productMarketingArtwork';
import type { CatalogProduct } from '../types/catalog';
import '../index.css';
async function boot() {
 const raw=await (await fetch('/tmp-tests/marketing-scenes-fixture/product.json')).json();
 const product={...raw,price_retail:Number(raw.price_retail)} as CatalogProduct;
 const data=buildProductMarketingArtworkData(product,[],0,'Cozinha');
 function App(){
  const [title,setTitle]=useState(data.commercial.title),[price,setPrice]=useState(true),[template,setTemplate]=useState<'showcase'|'technical'>('showcase');
  return <><div id="controls"><button onClick={()=>setTitle('PRATICIDADE NA SUA COZINHA')}>Editar título</button><button onClick={()=>setPrice(p=>!p)}>Alternar preço</button><button onClick={()=>setTemplate(t=>t==='showcase'?'technical':'showcase')}>Alternar modelo</button></div><div id="art" style={{position:'relative',width:1080,height:1920}}><ProductMarketingCard data={{...data,commercial:{...data.commercial,title}}} format="status" imageUrl="/tmp-tests/marketing-scenes-fixture/product.webp" backgroundUrl="/tmp-tests/marketing-scenes-fixture/kitchen.jpg" logoUrl="/brand/mercado-do-vale-logo.png" whatsapp="(87) 98803-2612" website="mercadodovale.com.br" showPrice={price} template={template}/></div></>;
 }
 createRoot(document.getElementById('root')!).render(<App/>);
 Object.assign(window,{exportTestArtwork:()=>toPng(document.getElementById('art')!,{width:1080,height:1920,pixelRatio:1,cacheBust:false})});
}
void boot();
