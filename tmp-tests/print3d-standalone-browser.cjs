const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),calls=[],external=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('@mdv_vps_auth_session',JSON.stringify({token:'MDV_MUST_NOT_LEAK',user:{id:'admin'}})));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://127.0.0.1:3002'){external.push(url.origin);return route.abort();}
   if(url.pathname.includes('vps-proxy')||url.pathname.startsWith('/api/')){
    const endpoint=url.searchParams.get('path')||url.pathname;calls.push(endpoint);
    const routePath=endpoint.split('?')[0];
    assert(!JSON.stringify(req.headers()).includes('MDV_MUST_NOT_LEAK'));
    assert(!req.headers()['x-sync-key']);
    if(['/categories','/storefronts/loja_3d/products','/banners'].includes(routePath))return route.fulfill({contentType:'application/json',body:'[]'});
    if(endpoint==='/print3d/auth/google/config')return route.fulfill({contentType:'application/json',body:'{"configured":false}'});
    return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Teste local: função desativada."}'});
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3002/');
  await page.getByRole('heading',{name:'Vaso Aura',exact:true}).first().waitFor();
  assert.equal(new URL(page.url()).pathname,'/loja-3d');
  await page.goto('http://127.0.0.1:3002/loja-3d/conta');
  await page.locator('input').first().waitFor();
  await page.goto('http://127.0.0.1:3002/admin/login');
  await page.getByRole('heading',{name:'Página não encontrada'}).waitFor();
  assert.equal(await page.getByText('Área Administrativa',{exact:true}).count(),0);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  assert(calls.length>0);
  assert(calls.every(p=>['/categories','/storefronts/loja_3d/products','/banners','/print3d/auth/google/config'].includes(p.split('?')[0])),JSON.stringify(calls));
  console.log('PASS standalone: catalog/account, no MDV credentials/global APIs/admin route; local intercepted network only.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
