const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const page = await browser.newPage({viewport:{width:390,height:844}});
 const product = {id:'p3d',name:'Vaso de teste 3D',sku:'TEST-3D',slug:'vaso-teste',price_retail:4900,status:'active',stock_quantity:2,available_stock:2,images:[],specs:{},category_id:'decoracao'};
 const banner = {id:'b3d',storefront:'loja_3d',title:'Coleção 3D',active:true,display_order:0,image_url:'http://127.0.0.1:3000/banner-test.svg',link_url:'/produto/p3d'};
 const api = [];
 await page.route('**/*', route => {
   const request = route.request(), url = new URL(request.url()), decoded = decodeURIComponent(request.url());
   if (url.pathname === '/banner-test.svg') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="549"><rect width="1280" height="549" fill="#d9cbb8"/><circle cx="900" cy="270" r="180" fill="#ad7758"/></svg>'});
   if (decoded.includes('/vps-proxy') || url.hostname !== '127.0.0.1') {
     api.push(decoded);
     const data = decoded.includes('/storefronts/loja_3d/products') ? [product]
       : decoded.includes('/banners?') ? [banner,{...banner,id:'mdv',storefront:'mercado_do_vale',title:'Não exibir MDV'},
         {...banner,id:'inactive',active:false,title:'Não exibir inativo'},
         {...banner,id:'expired',end_date:'2000-01-01',title:'Não exibir expirado'},
         {...banner,id:'future',start_date:'2099-01-01',title:'Não exibir futuro'}]
       : decoded.includes('/categories') ? [{id:'decoracao',name:'Decoração'}] : [];
     return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   }
   return route.continue();
 });
 await page.goto('http://127.0.0.1:3000/loja-3d');
 await page.getByRole('img',{name:'Coleção 3D',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Coleção 3D',exact:true}).count(),0);
 assert.equal(await page.getByText('Não exibir MDV').count(),0);
 assert.equal(await page.getByText(/Não exibir (inativo|expirado|futuro)/).count(),0);
 await page.screenshot({path:'C:/Users/Nitro/.codex/visualizations/2026/09/25/01a0d7e9-06df-7743-aa77-6b4637f66647/banner-3d.png'});
 await page.getByRole('img',{name:'Coleção 3D',exact:true}).click();
 await page.getByRole('dialog',{name:'Vaso de teste 3D',exact:true}).waitFor();
 assert.ok(page.url().includes('/loja-3d?produto=p3d'));
 assert.ok(api.some(url=>url.includes('storefront=loja_3d')));
 await browser.close();
 console.log('PASS: banner mobile, isolamento por loja e link para produto 3D; rede externa simulada.');
})().catch(e=>{console.error(e);process.exit(1)});
