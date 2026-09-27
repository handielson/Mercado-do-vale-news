const assert=require('node:assert/strict');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 let authStatus=200;
 let vite,browser,orderStatus='cancelled',paymentStatus='pending';const calls=[],external=[],errors=[];
 const orderId='11111111-1111-4111-8111-111111111111';
 const api=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local.test');calls.push({path:url.pathname,headers:req.headers});
  res.setHeader('Content-Type','application/json');
  const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(['/categories','/banners'].includes(url.pathname))return send([]);
  if(url.pathname==='/storefronts/loja_3d/quote'){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const input=JSON.parse(Buffer.concat(chunks).toString());
   const items=input.items.map(item=>({...item,unit_price:2500,subtotal:2500*item.quantity,ready_quantity:item.quantity,preorder_quantity:0,status:'available'}));
   return send({items,subtotal:items.reduce((sum,item)=>sum+item.subtotal,0),payment_schedule:{}});
  }
  if(url.pathname==='/storefronts/loja_3d/products')return send([
   {id:orderId,model_id:'local-model',sku:'TEST-3D',name:'Peça de teste local',status:'active',price_retail:2500,stock_quantity:10,available_stock:10,is_print3d:true,images:[],specs:{material:'PLA',color:'Preto',size:'P',finish:'Fosco'}},
   {id:'22222222-2222-4222-8222-222222222222',model_id:'local-model',sku:'TEST-3D-G',name:'Peça de teste local',status:'active',price_retail:3500,stock_quantity:0,available_stock:0,is_print3d:true,print3d_preorder_enabled:true,production_days:4,images:[],specs:{Material:'PLA',Cor:'Preto',Tamanho:'Grande',Acabamento:'Brilhante'}}]);
  if(url.pathname==='/print3d/auth/google/config')return send({configured:false});
  if(req.headers.authorization!=='Bearer local-3d-customer')return send({error:'Sessão 3D necessária'},401);
  if(url.pathname==='/print3d/auth/me'&&authStatus!==200)return send({error:'Consulta temporariamente indisponível'},authStatus);
  if(url.pathname==='/print3d/auth/me')return send({customer:{id:'customer',name:'Cliente local',email:'test@example.test'}});
  if(url.pathname==='/print3d/auth/phone/status')return send({phone:'5587999999999',verified:true});
  if(url.pathname==='/print3d/orders')return send({orders:[{id:orderId,order_number:'3D-LOCAL',status:orderStatus,payment_status:paymentStatus,created_at:'2026-09-27',subtotal_cents:2500,shipping_cents:0,total_cents:2500,confirmed_cents:0,outstanding_cents:2500,payment_schedule:{initial_cents:1250,balance_cents:1250},items:[{product_id:orderId,product_name:'Peça de teste local',product_sku:'TEST-3D',quantity:1,preorder_quantity:0,subtotal_cents:2500}]}]});
  if(url.pathname.endsWith('/payment')&&orderStatus==='awaiting_payment'&&paymentStatus==='pending')return send({charges:[],coverage:{confirmed_cents:0,outstanding_cents:2500,initial_payment_covered:false,fully_paid:false}});
  return send({error:'Pedido indisponível para pagamento.'},409);
 });
 try {
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  process.env.PRINT3D_LOCAL_API_ORIGIN=`http://127.0.0.1:${api.address().port}`;
  const {createServer}=await import('vite');
  vite=await createServer({configFile:'vite.print3d.config.ts',cacheDir:'node_modules/.vite-print3d-gateway-test',server:{port:0},logLevel:'error'});await vite.listen();
  const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}return route.continue();});
  await page.addInitScript(()=>{
   sessionStorage.setItem('print3d_customer_session_v1','local-3d-customer');
   localStorage.setItem('@mdv_vps_auth_session',JSON.stringify({token:'MDV_MUST_NOT_LEAK',user:{id:'admin'}}));
  });
  await page.goto(base+'/');await page.getByRole('heading',{name:'Peça de teste local',exact:true}).waitFor();
  await page.getByLabel('Buscar produto',{exact:true}).fill('Brilhante');
  await page.getByRole('button',{name:'Ver produto',exact:false}).click();
  const detail=page.getByRole('dialog',{name:'Peça de teste local',exact:true});
  await detail.getByText('Escolha sua variação',{exact:true}).waitFor();
  const large=detail.getByRole('button',{name:/PLA · Preto · Grande · Brilhante/});
  assert.equal(await large.getAttribute('aria-pressed'),'true');
  assert.match(await large.innerText(),/35,00/);assert.match(await large.innerText(),/4 dias úteis/);
  const small=detail.getByRole('button',{name:/PLA · Preto · P · Fosco/});await small.click();
  assert.equal(await small.getAttribute('aria-pressed'),'true');
  assert.match(await small.innerText(),/25,00/);assert.match(await small.innerText(),/10 em estoque/);
  await detail.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();
  const cart=page.getByRole('dialog',{name:'Carrinho da loja 3D',exact:true});await cart.waitFor();
  await cart.getByText('PLA · Preto · P · Fosco',{exact:true}).waitFor();
  const quoteUpdated=page.waitForResponse(r=>decodeURIComponent(r.url()).endsWith('/storefronts/loja_3d/quote'));
  await cart.getByRole('button',{name:'Aumentar Peça de teste local — PLA · Preto · P · Fosco — SKU TEST-3D',exact:true}).click();
  assert.equal((await quoteUpdated).status(),200);
  await page.waitForLoadState('networkidle');assert.equal(await cart.getByRole('alert').count(),0);
  await page.goto(base+'/loja-3d/conta');await page.getByRole('link',{name:'Meus pedidos e pagamentos',exact:true}).waitFor();
  await page.getByRole('link',{name:'Meus pedidos e pagamentos',exact:true}).click();
  await page.getByRole('heading',{name:'Pedido 3D-LOCAL'}).waitFor();
  // Let the component's payment effect complete before asserting its absence.
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('alert').count(),0);
  assert(!calls.some(c=>c.path.endsWith('/payment')),'cancelled orders must not query an unavailable payment endpoint');
  for(const terminal of ['refunded','failed']) {
   orderStatus='awaiting_payment';paymentStatus=terminal;
   await page.reload();await page.getByRole('heading',{name:'Pedido 3D-LOCAL'}).waitFor();await page.waitForLoadState('networkidle');
   assert.equal(await page.getByRole('alert').count(),0);
   assert(!calls.some(c=>c.path.endsWith('/payment')));
  }
  paymentStatus='pending';await page.reload();
  await page.getByRole('heading',{name:'Pagamento da entrada',exact:true}).waitFor();await page.waitForLoadState('networkidle');
  assert(calls.some(c=>c.path.endsWith('/payment')),'active orders must still retrieve payment state');
  assert.equal(await page.getByRole('alert').count(),0);
  assert(!calls.some(c=>JSON.stringify(c.headers).includes('MDV_MUST_NOT_LEAK')));
  assert(calls.filter(c=>c.path.startsWith('/print3d/')&&!c.path.endsWith('/config')).every(c=>c.headers.authorization==='Bearer local-3d-customer'));
  authStatus=503;await page.goto(base+'/loja-3d/conta');
  await page.getByText('As contas da loja 3D ainda não estão disponíveis.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('print3d_customer_session_v1')),'local-3d-customer');
  authStatus=200;await page.reload();await page.getByRole('link',{name:'Meus pedidos e pagamentos',exact:true}).waitFor();
  authStatus=401;await page.reload();await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('print3d_customer_session_v1')),null);
  assert.equal(await page.getByRole('link',{name:'Meus pedidos e pagamentos',exact:true}).count(),0);
  const blocked=await page.request.get(base+'/api/vps-proxy?path=%2Fadmin%2Fprint3d%2Forders');assert.equal(blocked.status(),403);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: real browser → local 3D proxy → fixture HTTP API, catalog, customer session, cancelled order and channel isolation.');
 } finally {if(browser)await browser.close();if(vite)await vite.close();api.closeAllConnections();await new Promise(r=>api.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
