import {build} from 'vite';
import {createServer} from 'node:http';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import local from '../scripts/mercado-livre-local-codex.cjs';
const id='11111111-1111-4111-8111-111111111111';
const snapshot={schema:'mdv.ml.catalog.v1',sellerId:'123',nickname:'CONTA SIMULADA',mode:'legacy',capturedAt:new Date().toISOString(),complete:true,
  products:[{id,sku:'TESTE-1',name:'Produto simulado',description:'Descrição do cadastro',brand:'Marca',color:'Ciano',model_name:'Modelo teste',warranty_type:'brand',warranty_days:90,weight_kg:'0.1000',dimensions:'{"height_cm":17,"width_cm":8,"depth_cm":1.5}',price_retail:12345,stock_quantity:3,status:'active',images:['https://loja.example/foto.png']}],links:[],listings:[]};
const source={kind:'manufacturer',reference:'https://fabricante.example/modelo',note:'Fonte simulada'};
const proposal={schema:'mdv.ml.preparation.v1',sellerId:'123',proposals:[{productId:id,sku:'TESTE-1',fields:{title:{value:'Título pesquisado',sources:[source]},categoryId:{value:'MLB123',sources:[source]},condition:{value:'new',sources:[source]}}}],notes:['Pesquisa simulada para teste; nenhum acesso real.']};
const entry={name:'ml-ui-test-entry',resolveId(id){if(id==='/__ml-entry.tsx')return id;},load(id){if(id==='/__ml-entry.tsx')return `import React from 'react';import {createRoot} from 'react-dom/client';import Page from '${process.cwd().replaceAll('\\','/')}/pages/admin/settings/MercadoLivrePreparationPage.tsx';import '${process.cwd().replaceAll('\\','/')}/index.css';createRoot(document.getElementById('root')).render(<Page/>);`;}};
const bundle=await build({configFile:false,envDir:'tmp-tests/no-env',resolve:{alias:{'@':process.cwd()}},define:{'import.meta.env.DEV':'true'},plugins:[react(),entry],logLevel:'error',build:{write:false,rollupOptions:{input:'/__ml-entry.tsx',output:{inlineDynamicImports:true}}}});
const files=new Map(bundle.output.map(file=>['/'+file.fileName,file]));
const script=bundle.output.find(file=>file.type==='chunk' && file.isEntry).fileName;
const styles=bundle.output.filter(file=>file.fileName.endsWith('.css')).map(file=>`<link rel="stylesheet" href="/${file.fileName}">`).join('');
let middleware;local.localResearchPlugin({research:async()=>proposal}).configureServer({middlewares:{use:handler=>middleware=handler}});
const server=createServer((req,res)=>middleware(req,res,()=>{
  if(req.url==='/__ml-ui'){res.setHeader('Content-Type','text/html');return res.end(`${styles}<div id="root"></div><script type="module" src="/${script}"></script>`);}
  const file=files.get(req.url);if(!file){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.fileName.endsWith('.css')?'text/css':'application/javascript');res.end(file.type==='chunk'?file.code:file.source);
}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);
  const errors=[],unexpected=[];let published=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{
    const url=decodeURIComponent(route.request().url());
    if(url.includes('/mercado-livre/preparation/')){
      let response;
      if(url.includes('/snapshot-jobs/'))response={status:'complete',result:snapshot};
      else if(url.includes('/snapshot-jobs'))response={id:'consulta-simulada'};
      else if(url.includes('/snapshot'))response=snapshot;
      else if(url.includes('/categories/'))response={category:{id:'MLB123'},attributes:[{id:'BRAND',name:'Marca',tags:{required:true}}]};
      else if(url.includes('/pricing')){const body=route.request().postDataJSON();assert.equal(body.pricingPolicy.marginBps,2000);response={priceCents:12345,costCents:6000,saleFeeCents:1852,listingFeeCents:0,taxCents:0,adsCents:0,otherPercentCents:0,packagingCents:0,shippingCents:0,otherFixedCents:0,profitCents:4493,marginBps:3639,targetMarginBps:2000,policy:body.pricingPolicy,feeReference:'https://api.mercadolibre.com/sites/MLB/listing_prices',quotedAt:new Date().toISOString()};}
      else if(url.includes('/preview'))response={sellerId:'123',mode:'legacy',payload:{price:123.45,available_quantity:3,shipping:{free_shipping:false},listing_type_id:'gold_special'}};
      else if(url.includes('/publish')){published++;response={itemId:'MLB999',alreadyPublished:false};}
      else throw new Error('Rota simulada desconhecida: '+url);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    }
    if(route.request().url().startsWith(origin+'/'))return route.continue();unexpected.push(url);return route.abort();
  });
  await page.goto(origin+'/__ml-ui');
  await page.getByRole('button',{name:'1. Carregar produtos do sistema'}).click();
  await page.getByText('TESTE-1 — Produto simulado').locator('input').check();
  await page.getByText('Dados aproveitados do cadastro:',{exact:false}).waitFor();
  assert.match(await page.getByText('Dados aproveitados do cadastro:',{exact:false}).innerText(),/cor Ciano.*100 g.*17 × 8 × 1.5 cm.*garantia 90 dias/);
  assert.equal(await page.getByRole('textbox',{name:'Prazo da garantia',exact:false}).inputValue(),'90 dias');
  await page.getByRole('button',{name:'Atributos',exact:true}).click();
  const catalogAttributes=JSON.parse(await page.getByRole('textbox',{name:'Valor de Atributos',exact:true}).inputValue());
  assert.deepEqual(catalogAttributes,{BRAND:'Marca',MODEL:'Modelo teste',COLOR:'Ciano'});
  await page.getByRole('button',{name:'Pesquisar e comparar com o Codex local'}).click();
  await page.getByText('Pesquisa recebida.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Aceitar proposta'}).click();
  await page.getByRole('button',{name:'Consultar exigências oficiais da categoria'}).click();
  await page.getByRole('combobox',{name:'Tipo do anúncio'}).selectOption('gold_special');
  await page.getByRole('textbox',{name:'Tipo da garantia',exact:false}).fill('Garantia do vendedor');
  await page.getByRole('textbox',{name:'Prazo da garantia',exact:false}).fill('90 dias');
  await page.getByRole('combobox',{name:'Modo de envio'}).selectOption('me2');
  await page.getByRole('combobox',{name:'Quem paga o frete?'}).selectOption('buyer');
  await page.getByRole('textbox',{name:'Margem líquida desejada (%)',exact:true}).fill('20');
  await page.getByRole('combobox',{name:'Modalidade logística'}).selectOption('drop_off');
  await page.getByRole('spinbutton',{name:'Peso faturável (gramas)'}).fill('1000');
  await page.getByRole('button',{name:'Calcular preço deste anúncio'}).click();
  await page.getByText('Lucro estimado por unidade',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Declarar autoria das fotos cadastradas'}).click();
  const checks=page.getByRole('checkbox',{name:'Conferi valor e fontes'});
  for(let i=0;i<await checks.count();i++)if(await checks.nth(i).isEnabled())await checks.nth(i).check();
  await page.getByRole('button',{name:'Validar anúncio no Mercado Livre'}).click();
  await page.getByRole('button',{name:'Publicar anúncio revisado'}).waitFor();assert.equal(published,0);
  await page.getByRole('button',{name:'Publicar anúncio revisado'}).click();
  await page.getByText('Anúncio MLB999 publicado e vinculado ao produto.').waitFor();assert.equal(published,1);
  assert.equal(await page.getByRole('button',{name:'Validar anúncio no Mercado Livre'}).isDisabled(),true);
  assert.ok(await page.evaluate(()=>localStorage.getItem('mdv.ml.last-draft')));
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('mdv.ml.pricing-policy.123'))).marginBps,'20');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  await mkdir('output/mercado-livre',{recursive:true});await page.screenshot({path:'output/mercado-livre/automacao-validada.png',fullPage:true});
  console.log('UI PASS: catálogo, pesquisa local simulada, conflito, exigências, revisão, validação, publicação simulada e bloqueio de repetição; zero rede externa.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
