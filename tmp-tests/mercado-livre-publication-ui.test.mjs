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
const entry={name:'ml-ui-test-entry',resolveId(id){if(id==='/__ml-entry.tsx')return id;},load(id){if(id==='/__ml-entry.tsx')return `import React from 'react';import {createRoot} from 'react-dom/client';import Page from '${process.cwd().replaceAll('\\','/')}/pages/admin/settings/MercadoLivrePreparationPage.tsx';import Catalog from '${process.cwd().replaceAll('\\','/')}/components/products/sections/MercadoLivreCatalogAttributes.tsx';import '${process.cwd().replaceAll('\\','/')}/index.css';function CatalogTest(){const [fields,setFields]=React.useState({'is_parent':true,'model_id':'modelo','category_id':'cat-local','specs.color':'Ciano','name':location.pathname==='/__ml-category-ui'?'Produto único':''});return <><label>Nome do produto<input value={fields.name} onChange={e=>setFields(previous=>({...previous,name:e.target.value}))}/></label><Catalog productId='${id}' categoryConfig={location.pathname==='/__ml-category-ui'?{}:{mercado_livre:{category_id:'MLB123',category_name:'Capas',attributes:[{id:'MATERIAL',name:'Material do exterior',tags:{},value_type:'string'},{id:'WATERPROOF',name:'À prova de água',tags:{},value_type:'boolean',values:[{id:'1',name:'Sim'},{id:'2',name:'Não'}]},{id:'COLOR',name:'Cor',tags:{allow_variations:true}},{id:'INTERNAL',name:'Campo interno',tags:{read_only:true}}]}}} watch={key=>fields[key]} setValue={(key,value)=>setFields(previous=>({...previous,[key]:value}))}/></>;}createRoot(document.getElementById('root')).render(location.pathname.includes('catalog') || location.pathname.includes('category')?<CatalogTest/>:<Page/>);`;}};
const bundle=await build({configFile:false,envDir:'tmp-tests/no-env',resolve:{alias:{'@':process.cwd()}},define:{'import.meta.env.DEV':'true'},plugins:[react(),entry],logLevel:'error',build:{write:false,rollupOptions:{input:'/__ml-entry.tsx',output:{inlineDynamicImports:true}}}});
const files=new Map(bundle.output.map(file=>['/'+file.fileName,file]));
const script=bundle.output.find(file=>file.type==='chunk' && file.isEntry).fileName;
const styles=bundle.output.filter(file=>file.fileName.endsWith('.css')).map(file=>`<link rel="stylesheet" href="/${file.fileName}">`).join('');
let middleware;local.localResearchPlugin({research:async()=>proposal}).configureServer({middlewares:{use:handler=>middleware=handler}});
const server=createServer((req,res)=>middleware(req,res,()=>{
  if(req.url==='/__ml-ui' || req.url==='/__ml-catalog-ui' || req.url==='/__ml-category-ui'){res.setHeader('Content-Type','text/html');return res.end(`${styles}<div id="root"></div><script type="module" src="/${script}"></script>`);}
  const file=files.get(req.url);if(!file){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.fileName.endsWith('.css')?'text/css':'application/javascript');res.end(file.type==='chunk'?file.code:file.source);
}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);
  const errors=[],unexpected=[];let published=0, categoryCalls=0;
  let releaseDiscovery,markDiscoveryReady;const discoveryReady=new Promise(resolve=>markDiscoveryReady=resolve);let releaseOther, markOtherReady;const otherReady=new Promise(resolve=>markOtherReady=resolve);
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{
    const url=decodeURIComponent(route.request().url());
    if(url.includes('/mercado-livre/catalog/category-discovery')){const title=route.request().postDataJSON().title;if(title==='Produto atrasado'){markDiscoveryReady();await new Promise(resolve=>releaseDiscovery=resolve);return route.fulfill({json:{suggestions:[{id:'MLB124',name:'Categoria atrasada'}]}});}const suggestions=title==='Produto único'?[{id:'MLB123',name:'Capas'}]:title==='Produto ambíguo'?[{id:'MLB123',name:'Capas'},{id:'MLB124',name:'Outra categoria'}]:[];return route.fulfill({json:{suggestions}});}
    if(url.includes('/mercado-livre/catalog/categories'))return route.fulfill({json:url.includes('parentId=MLB123')?{categories:[],parent:{id:'MLB123',name:'Capas'}}:{categories:[{id:'MLB123',name:'Capas'}],parent:null}});
    if(url.includes('/mercado-livre/catalog/products/')) {
      const body=route.request().postDataJSON();assert.deepEqual(body.attributes,{MATERIAL:'Silicone',WATERPROOF:'Não'});assert.equal(body.saveForFamily,true);assert.equal(body.saveForModel,true);assert.equal(body.saveCategorySchema,true);assert.equal(body.expectedCategoryId,'cat-local');assert.equal(body.expectedModelId,'modelo');assert.equal(body.price,undefined);assert.equal(body.stock_quantity,undefined);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,affectedProducts:6,savedForModel:true,savedCategorySchema:true,categoryId:'MLB123',attributes:body.attributes})});
    }
    if(url.includes('/mercado-livre/preparation/')){
      let response;
      if(url.includes('/snapshot-jobs/'))response={status:'complete',result:snapshot};
      else if(url.includes('/snapshot-jobs'))response={id:'consulta-simulada'};
      else if(url.includes('/snapshot'))response=snapshot;
      else if(url.includes('/categories/')){categoryCalls++;const other=url.endsWith('/MLB124');if(other)await new Promise(resolve=>{releaseOther=resolve;markOtherReady();});response={category:{id:url.split('/categories/')[1],name:'Categoria simulada'},attributes:other?[{id:'OTHER',name:'Campo de outra categoria',tags:{}}]:[{id:'BRAND',name:'Marca',tags:{required:true}},{id:'MATERIAL',name:'Material do exterior',value_type:'string',tags:{}},{id:'WATERPROOF',name:'É à prova de água',value_type:'boolean',tags:{},values:[{id:'1',name:'Sim'},{id:'2',name:'Não'}]},{id:'LENGTH',name:'Comprimento',value_type:'number_unit',allowed_units:[{id:'cm',name:'cm'},{id:'mm',name:'mm'}],default_unit:'cm',tags:{}},{id:'INTERNAL',name:'Campo interno',tags:{read_only:true}},{id:'GTIN',name:'Código universal',tags:{}}]};}
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
  await page.getByRole('textbox',{name:'Material do exterior',exact:true}).waitFor();assert.equal(categoryCalls,1);
  await page.getByRole('textbox',{name:'Material do exterior',exact:true}).fill('Silicone');
  await page.getByRole('combobox',{name:'É à prova de água',exact:true}).selectOption('Não');
  await page.getByRole('textbox',{name:'Comprimento',exact:true}).fill('17');
  await page.getByRole('combobox',{name:'Unidade de Comprimento',exact:true}).selectOption('mm');
  assert.equal(await page.getByRole('textbox',{name:'Campo interno',exact:true}).isDisabled(),true);
  const attrCard=page.getByRole('textbox',{name:'Material do exterior',exact:true}).locator('..');
  await attrCard.getByRole('checkbox').check();assert.equal(await page.getByRole('textbox',{name:'Material do exterior',exact:true}).isDisabled(),true);
  await attrCard.getByRole('checkbox').uncheck();await page.getByRole('textbox',{name:'Material do exterior',exact:true}).fill('Silicone');
  await page.getByRole('button',{name:'Categoria',exact:true}).click();
  await page.getByRole('textbox',{name:'Valor de Categoria',exact:true}).fill('MLB124');
  await page.getByRole('button',{name:'Salvar edição e revisar confirmação'}).click();await otherReady;
  assert.equal(await page.getByRole('textbox',{name:'Material do exterior',exact:true}).count(),0);
  await page.getByRole('textbox',{name:'Valor de Categoria',exact:true}).fill('MLB123');
  await page.getByRole('button',{name:'Salvar edição e revisar confirmação'}).click();
  await page.getByRole('textbox',{name:'Material do exterior',exact:true}).waitFor();
  const otherResponse=page.waitForResponse(r=>decodeURIComponent(r.url()).includes('/categories/MLB124'));releaseOther();await otherResponse;
  assert.equal(await page.getByRole('textbox',{name:'Campo de outra categoria',exact:true}).count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Material do exterior',exact:true}).inputValue(),'Silicone');
  await page.getByRole('button',{name:'Consultar exigências oficiais da categoria'}).click();
  await page.getByText('Carregando todos os atributos oficiais…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByRole('textbox',{name:'Material do exterior',exact:true}).inputValue(),'Silicone');
  await page.getByRole('combobox',{name:'Tipo do anúncio'}).selectOption('gold_special');
  await page.getByRole('textbox',{name:'Tipo da garantia',exact:false}).fill('Garantia do vendedor');
  await page.getByRole('textbox',{name:'Prazo da garantia',exact:false}).fill('90 dias');
  await page.getByRole('combobox',{name:'Modo de envio'}).selectOption('me2');
  await page.getByRole('combobox',{name:'Quem paga o frete?'}).selectOption('buyer');
  await page.getByRole('textbox',{name:'Margem líquida desejada (%)',exact:true}).fill('20');
  await page.getByRole('combobox',{name:'Modalidade logística'}).selectOption('drop_off');
  assert.equal(await page.getByRole('spinbutton',{name:'Peso faturável (gramas)'}).inputValue(),'100');
  assert.equal(await page.getByRole('spinbutton',{name:'Peso faturável (gramas)'}).isDisabled(),true);
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
  const reviewed=JSON.parse(await page.evaluate(()=>localStorage.getItem('mdv.ml.last-draft'))).batch.drafts[0];
  snapshot.mode='user_products';
  snapshot.products=[{...snapshot.products[0],id:'parent',sku:'FAMILIA',name:'Família simulada',is_parent:1,stock_quantity:0},...Array.from({length:5},(_,n)=>({...snapshot.products[0],id:`child-${n}`,sku:`COR-${n}`,parent_id:'parent',color:`Cor ${n}`,stock_quantity:n===4?0:1}))];
  snapshot.links=[{product_id:'child-0',item_id:'MLB100'}];
  await page.getByRole('button',{name:'1. Carregar produtos do sistema'}).click();
  await page.getByRole('checkbox',{name:'Selecionar família FAMILIA'}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Selecionar família FAMILIA'}).count(),1);
  await page.getByRole('checkbox',{name:'Selecionar família FAMILIA'}).check();
  await page.getByText('1 famílias/produtos selecionados • 3 variações/produtos para preparar.',{exact:false}).waitFor();
  await page.getByText('COR-0 — Cor 0 • Estoque: 1 • Já anunciado',{exact:false}).waitFor();
  await page.getByText('COR-4 — Cor 4 • Estoque: 0 • Sem estoque disponível',{exact:false}).waitFor();
  const familyFile=JSON.parse(await page.evaluate(()=>localStorage.getItem('mdv.ml.last-draft')));
  assert.deepEqual(familyFile.batch.drafts.map(d=>d.sku),['COR-1','COR-2','COR-3']);
  familyFile.batch.drafts=familyFile.batch.drafts.map(d=>({...d,fields:structuredClone(reviewed.fields)}));
  for(const d of familyFile.batch.drafts){d.fields.familyName={value:'Família simulada Marca',sources:[source],confirmed:false};d.fields.quantity.value=1;}
  await page.getByLabel('Reabrir rascunho salvo').setInputFiles({name:'familia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(familyFile))});
  await page.getByText('Configuração da conta',{exact:false}).click();
  await page.getByRole('button',{name:'Confirmar modo verificado'}).click();
  for(const d of familyFile.batch.drafts){
    await page.getByRole('combobox',{name:'Rascunho em revisão'}).selectOption(d.productId);
    const reviews=page.getByRole('checkbox',{name:'Conferi valor e fontes'});
    for(let i=0;i<await reviews.count();i++)if(await reviews.nth(i).isEnabled())await reviews.nth(i).check();
  }
  await page.getByRole('button',{name:'Validar família no Mercado Livre'}).click();
  await page.getByRole('button',{name:'Enviar todas as variações validadas'}).waitFor();
  assert.equal(published,1);
  await page.getByRole('button',{name:'Enviar todas as variações validadas'}).click();
  await page.getByText('Família enviada:',{exact:false}).waitFor();assert.equal(published,4);
  assert.equal(await page.getByRole('button',{name:'Validar família no Mercado Livre'}).isDisabled(),true);
  await page.goto(origin+'/__ml-category-ui');
  await page.getByText('Categoria simulada • 6 atributos oficiais',{exact:false}).waitFor();
  await page.getByText('Categoria selecionada: Capas.',{exact:false}).waitFor();
  await page.getByLabel('Nome do produto',{exact:true}).fill('Produto ambíguo');
  await page.getByRole('button',{name:'Buscar categoria pelo nome do produto',exact:true}).click();
  await page.getByRole('button',{name:'Outra categoria (MLB124)',exact:true}).waitFor();
  await page.getByRole('button',{name:'Capas (MLB123)',exact:true}).click();
  await page.getByLabel('Nome do produto',{exact:true}).fill('Produto não encontrado');
  await page.getByRole('button',{name:'Buscar categoria pelo nome do produto',exact:true}).click();
  await page.getByText('Nenhuma categoria encontrada.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Capas',exact:true}).click();
  await page.getByText('Categoria selecionada: Capas.',{exact:false}).waitFor();
  await page.getByLabel('Nome do produto',{exact:true}).fill('Produto atrasado');
  await page.getByRole('button',{name:'Buscar categoria pelo nome do produto',exact:true}).click();await discoveryReady;
  await page.getByRole('button',{name:'Escolher categoria manualmente',exact:true}).click();
  await page.getByRole('button',{name:'Capas',exact:true}).click();
  const delayed=page.waitForResponse(r=>decodeURIComponent(r.url()).includes('/category-discovery'));releaseDiscovery();await delayed;
  await page.getByText('Categoria selecionada: Capas.',{exact:false}).waitFor();
  assert.equal(await page.getByText('Categoria selecionada: Categoria atrasada.',{exact:false}).count(),0);
  await page.goto(origin+'/__ml-catalog-ui');
  await page.getByRole('textbox',{name:'Material do exterior',exact:true}).fill('Silicone');
  await page.getByRole('combobox',{name:'À prova de água',exact:true}).selectOption('Não');
  assert.equal(await page.getByRole('textbox',{name:'Cor',exact:true}).inputValue(),'Ciano');assert.equal(await page.getByRole('textbox',{name:'Cor',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox',{name:'Salvar atributos comuns no pai',exact:false}).check();
  await page.getByRole('checkbox',{name:'Usar atributos comuns como padrão do modelo',exact:false}).check();
  await page.getByRole('button',{name:'Salvar atributos no nosso sistema',exact:true}).click();
  await page.getByText('Atributos salvos no sistema para 6 produto(s)',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  await mkdir('output/mercado-livre',{recursive:true});await page.screenshot({path:'output/mercado-livre/automacao-validada.png',fullPage:true});
  console.log('UI PASS: catálogo, pesquisa local simulada, conflito, exigências, revisão, validação, publicação simulada e bloqueio de repetição; zero rede externa.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
