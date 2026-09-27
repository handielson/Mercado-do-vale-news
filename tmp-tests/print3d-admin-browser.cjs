const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.PRINT3D_TEST_BASE_URL || 'http://127.0.0.1:3001';
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  let mode='disabled'; const calls=[];const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('vps-proxy') || url.hostname==='api.xiaomipetrolina.com.br' || url.pathname.startsWith('/api/')) {
    const endpoint = url.searchParams.get('path') || url.pathname+url.search; calls.push(endpoint);
    if(mode==='banners' && endpoint==='/banners?storefront=loja_3d') return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(endpoint.startsWith('/admin/print3d/')) {
     const customers=endpoint.startsWith('/admin/print3d/customers');
     const customer={id:'client3d',name:'Cliente exclusivo 3D',email:'cliente@example.test',phone:null,is_active:true,email_verified_at:'2026-09-01',phone_verified_at:null,created_at:'2026-09-01'};
     const order={id:'order3d',order_number:'3D-42',status:['review','refunded'].includes(mode)?'cancelled':'awaiting_payment',payment_review:mode==='refunded'?{pending_cancellations:0,late_payments:0,late_amount_cents:0,refunded_payments:1}:mode==='review'?{pending_cancellations:1,late_payments:1,late_amount_cents:5000}:{pending_cancellations:0,late_payments:0,late_amount_cents:0},payment_status:'pending',created_at:'2026-09-01',customer,total_cents:11000,shipping_cents:1000,confirmed_cents:5000,outstanding_cents:6000,payment_schedule:{due_on_confirmation_cents:5000}};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:mode!=='disabled',storefront:mode==='wrong'?'mercado_do_vale':'loja_3d',items:mode==='disabled'?[]:[customers?customer:order],total:mode==='disabled'?0:26,page:endpoint.includes('page=2')?2:1,page_size:25})});
    }
    return route.abort();
   }
   return url.origin===base ? route.continue() : route.abort();
  });
  await page.goto(base+'/tmp-tests/print3d-admin-preview.html');
  await page.getByText('Cadastro de clientes 3D ainda não habilitado',{exact:true}).waitFor();
  assert.equal(await page.getByRole('alert').count(),0);
  mode='enabled';await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await page.getByRole('heading',{name:'Cliente exclusivo 3D'}).waitFor();
  await page.getByRole('button',{name:'Próxima'}).click();
  await page.getByText('Página 2 de 2').waitFor();
  await page.getByRole('textbox').fill('Ana');await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByText('Página 1 de 2').waitFor();assert(calls.some(path=>path.includes('search=Ana')&&path.includes('page=1')));
  await page.goto(base+'/tmp-tests/print3d-admin-preview.html?kind=orders');
  await page.getByRole('heading',{name:'Pedido 3D-42'}).waitFor();
  assert.match(await page.locator('body').innerText(),/110,00/);assert.match(await page.locator('body').innerText(),/60,00/);
  assert.equal(await page.getByText(/PIX aguardando conferência:/).count(),0);
  mode='review';await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await page.getByText(/PIX aguardando conferência: 1 cobrança/).waitFor();
  await page.getByText(/Pagamento após cancelamento:.*50,00/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Cancelar e liberar reservas',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Registrar expedição',exact:true}).count(),0);
  mode='refunded';await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await page.getByText(/Estorno integral confirmado pelo provedor: 1 cobrança/).waitFor();
  assert.equal(await page.getByText(/Pagamento após cancelamento:/).count(),0);
  mode='wrong';await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'A resposta não pertence à loja 3D.'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Pedido 3D-42'}).count(),0);
  assert(calls.every(path=>path.startsWith('/admin/print3d/customers')||path.startsWith('/admin/print3d/orders')));
  calls.length=0;mode='banners';await page.goto(base+'/tmp-tests/print3d-admin-preview.html?kind=banners');
  await page.getByRole('button',{name:'Novo Banner',exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Banners do site'}).count(),0);
  assert(calls.length>0);assert(calls.every(path=>path==='/banners?storefront=loja_3d'));
  assert.deepEqual(errors,[]);
  console.log('PASS: clientes/pedidos exclusivos, desativado, paginação, busca, origem divergente e banners fixos 3D; zero API real.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
