const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
test('listagem MDV descarta 3D e origens desconhecidas antes de carregar itens',async()=>{
 const source=fs.readFileSync('services/orderService.ts','utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const rows=[{id:'mdv',storefront:'mercado_do_vale'},{id:'legacy'},{id:'3d',storefront:'loja_3d'},{id:'unknown',storefront:'other'}];
 let itemReads=0;
 const exports={};vm.runInNewContext(js,{exports,console,require:name=>name==='./vpsClient'?{vpsClient:{get:async path=>{
  if(path.startsWith('/table-data/orders?'))return {rows};
  if(path.startsWith('/table-data/order_items?')){itemReads++;return {rows:[]};}
  throw Error(path);
 }}}:{}});
 const orders=await exports.getOrders();assert.deepEqual(Array.from(orders,row=>row.id),['mdv','legacy']);assert.equal(itemReads,2);
});
test('rotas por marca fixam banners e ofertas; menu tem área 3D própria',()=>{
 const routes=fs.readFileSync('routes/index.tsx','utf8'),menu=fs.readFileSync('layouts/AdminLayout.tsx','utf8');
 for(const path of ['clientes','pedidos','producao','calculadora','catalogo','banners'])assert(routes.includes('/admin/loja-3d/'+path));
 assert(routes.includes('fixedStorefront="loja_3d"'));assert(routes.includes('fixedStorefront="mercado_do_vale"'));
 assert(routes.includes('storefront="loja_3d"'));assert(menu.includes("title: 'Loja 3D'"));
 const offers=fs.readFileSync('pages/admin/products/ProductStorefrontOffersPage.tsx','utf8');
 assert(offers.includes('ALL_SITES.filter(site => !storefront || site.code === storefront)'));
 assert(offers.includes('categoryService.list(true)'));
 assert(offers.includes("offer.publication_status === 'published' && !offer.category_label"));
 assert(offers.includes('A escolha vale somente para o'));
 assert(menu.includes('if (isPrint3dArea) { setBotHealth(null); return; }'));
 assert(menu.includes('{!isPrint3dArea && <SaleAlerts />}'));
});
