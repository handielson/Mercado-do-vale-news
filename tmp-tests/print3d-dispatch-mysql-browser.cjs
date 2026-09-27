const assert=require('node:assert/strict');
const {chromium}=require('playwright');
module.exports=async function dispatchBrowser({app,orderId,orderNumber}) {
 const base='http://127.0.0.1:3000';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('@mdv_vps_auth_session',JSON.stringify({token:'local-admin',user:{id:'test-admin'}})));
  let posts=0;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.includes('vps-proxy')||url.pathname.startsWith('/api/')||url.hostname==='api.xiaomipetrolina.com.br') {
    const path=url.searchParams.get('path')||url.pathname+url.search;
    if(!path.startsWith('/admin/print3d/orders')) return route.abort();
    if(req.method()==='POST') {assert.equal(path,`/admin/print3d/orders/${orderId}/dispatch`);posts++;}
    const response=await app.inject({method:req.method(),url:path,headers:{authorization:req.headers().authorization||'','content-type':'application/json'},
      ...(req.method()==='POST'?{payload:req.postData()}: {})});
    return route.fulfill({status:response.statusCode,contentType:'application/json',body:response.body});
   }
   return url.origin===base?route.continue():route.abort();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+'/tmp-tests/print3d-admin-preview.html?kind=orders');
  await page.getByRole('textbox',{name:'Buscar'}).fill(orderNumber);
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Pedido '+orderNumber,exact:true})});
  await card.getByLabel('Código de rastreio').fill('READY-TRACK');
  await card.getByRole('button',{name:'Registrar expedição',exact:true}).click();
  await card.getByText('Rastreio: READY-TRACK',{exact:true}).waitFor();
  assert.equal(await card.getByRole('button',{name:'Registrar expedição',exact:true}).count(),0);
  assert.equal(posts,1);assert.deepEqual(errors,[]);
  console.log('PASS expedição no navegador móvel: confirma envio, atualiza rastreio e remove formulário com MySQL local.');
 } finally {await browser.close();}
};
