const assert=require('node:assert/strict');
const {chromium}=require('playwright');
module.exports=async function testProductionBrowser({app,jobId}) {
 const base='http://127.0.0.1:3000';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>{
   localStorage.setItem('@mdv_vps_auth_session',JSON.stringify({token:'local-admin',user:{id:'test-admin'}}));
   sessionStorage.setItem('print3d_customer_session_v1','local-customer');
  });
  let posts=0;
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   const path=url.searchParams.get('path')||url.pathname;
   if(url.pathname.includes('vps-proxy')||url.pathname.startsWith('/api/')||url.hostname==='api.xiaomipetrolina.com.br') {
    if(path==='/admin/preferences/print3d.cost.v1') return route.fulfill({json:{value:{filaments:[{id:'pla',name:'PLA',color:'Preto'}],supplies:[{id:'argola',name:'Argola',unitLabel:'un',unitCostCents:30}],packagingCentsPerPiece:0}}});
    if(!path.startsWith('/admin/print3d/')&&path!=='/print3d/production') return route.abort();
    if(request.method()==='POST') {
     assert.equal(path,`/admin/print3d/production/${jobId}/progress`);
     posts++;
    }
    const response=await app.inject({method:request.method(),url:path,headers:{authorization:request.headers().authorization||'', 'content-type':'application/json'},
      ...(request.method()==='POST'?{payload:request.postData()}: {})});
    return route.fulfill({status:response.statusCode,contentType:'application/json',body:response.body});
   }
   return url.origin===base?route.continue():route.abort();
  });
  const admin=await context.newPage();const errors=[];admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(base+'/tmp-tests/print3d-production-preview.html?view=admin');
  await admin.getByLabel('Novas aprovadas',{exact:true}).fill('20');
  await admin.getByLabel('Consumo de PLA Preto em gramas').fill('10');
  await admin.getByLabel('Consumo de Argola em un').fill('1');
  await admin.getByLabel('Observação interna').fill('NOTA PRIVADA DO TESTE MYSQL');
  await admin.getByRole('button',{name:'Registrar produção',exact:true}).click();
  await admin.getByRole('status').filter({hasText:'40 de 100'}).waitFor();
  assert.equal(posts,1);
  const customer=await context.newPage();customer.on('pageerror',e=>errors.push(e.message));
  await customer.goto(base+'/tmp-tests/print3d-production-preview.html?view=customer');
  await customer.getByText('Faltam 60 unidades para concluir a produção.').waitFor();
  assert.equal(await customer.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
  await customer.getByText('Histórico de produção',{exact:true}).click();
  assert.equal(await customer.getByText('NOTA PRIVADA DO TESTE MYSQL').count(),0);
  await admin.getByLabel('Novas aprovadas',{exact:true}).fill('10');
  await admin.getByLabel('Consumo de PLA Preto em gramas').fill('10');
  await admin.getByLabel('Consumo de Argola em un').fill('99');
  await admin.getByRole('button',{name:'Registrar produção',exact:true}).click();
  await admin.getByRole('alert').filter({hasText:'Saldo físico insuficiente'}).waitFor();
  assert.equal(await admin.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
  await customer.getByRole('button',{name:'Atualizar',exact:true}).click();
  await customer.getByRole('button',{name:'Atualizar',exact:true}).waitFor({state:'visible'});
  assert.equal(await customer.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
  assert.deepEqual(errors,[]);
  console.log('PASS navegador + Fastify + MySQL local: 20->40, privacidade do cliente e falha por falta de insumo.');
 } finally {await browser.close();}
};
