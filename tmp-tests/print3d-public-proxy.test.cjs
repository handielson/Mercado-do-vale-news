const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {targetPath,createPrint3dPublicProxy}=require('../services/print3dPublicProxy.cjs');
const id='11111111-1111-4111-8111-111111111111';
test('channel boundary rejects other channels, administrative paths, duplicate queries and traversal',()=>{
 for(const [method,path] of [['GET','/categories'],['GET','/banners?storefront=loja_3d'],['GET','/storefronts/loja_3d/products?limit=2000'],
 ['POST','/print3d/auth/login'],['POST',`/print3d/orders/${id}/payment`],['POST','/storefronts/loja_3d/shipping/quote'],['POST','/storefronts/loja_3d/quote']])assert.equal(targetPath(path,method),path);
 for(const path of ['/admin/print3d/orders','/products','/customers','/storefronts/mercado_do_vale/products','/banners',
 '/banners?storefront=mercado_do_vale','/banners?storefront=loja_3d&storefront=mercado_do_vale','//evil.test/categories',
 '/print3d/../categories','/print3d/%2e%2e/categories','/categories#anything','/categories?storefront=mercado_do_vale',
 '/storefronts/loja_3d/products?limit=2001','/categories?path=/products'])assert.equal(targetPath(path,'GET'),null,path);
 assert.equal(targetPath('/print3d/payments/webhook','POST'),null);
 assert.equal(targetPath('/storefronts/mercado_do_vale/quote','POST'),null);
 assert.equal(targetPath('/storefronts/loja_3d/quote?storefront=mercado_do_vale','POST'),null);
 assert.equal(targetPath('/categories','DELETE'),null);
 for(const apiOrigin of ['https://example.test','http://localhost:4000','http://127.0.0.1:4000/admin','http://user@127.0.0.1:4000'])assert.throws(()=>createPrint3dPublicProxy({apiOrigin}));
});
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
test('actual local HTTP proxy preserves 3D bearer only, strips secrets and cookies, and never follows redirect',async t=>{
 const received=[];
 const upstream=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);received.push({url:req.url,headers:req.headers,body:Buffer.concat(chunks).toString()});
  if(req.url==='/print3d/auth/me'){res.writeHead(302,{Location:'http://127.0.0.1:1/forbidden'});return res.end();}
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'must_not_pass=true'});res.end(JSON.stringify({ok:true}));});
 const origin=await listen(upstream);t.after(()=>close(upstream));
 const middleware=createPrint3dPublicProxy({apiOrigin:origin});
 const server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 const local=await listen(server);t.after(()=>close(server));
 const url=path=>local+'/api/vps-proxy?path='+encodeURIComponent(path);
 const headers={'Content-Type':'application/json',Authorization:'Bearer 3d-test',Cookie:'MDV=secret','X-Sync-Key':'must-not-pass','X-Forwarded-For':'forged'};
 let response=await fetch(url('/print3d/auth/login'),{method:'POST',headers,body:'{"login":"local","password":"fake"}'});
 assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(received[0].headers.authorization,'Bearer 3d-test');assert.equal(received[0].headers.cookie,undefined);assert.equal(received[0].headers['x-sync-key'],undefined);assert.equal(received[0].headers['x-forwarded-for'],undefined);
 assert.equal(JSON.parse(received[0].body).login,'local');
 await fetch(url('/categories'),{headers});assert.equal(received[1].headers.authorization,undefined);
 response=await fetch(url('/admin/print3d/orders'),{headers});assert.equal(response.status,403);assert.equal(received.length,2);
 response=await fetch(url('/print3d/auth/login'),{method:'POST',headers:{...headers,Origin:'https://other.test'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(url('/print3d/auth/login'),{method:'POST',headers,body:'invalid'});assert.equal(response.status,400);
 response=await fetch(url('/print3d/auth/login'),{method:'POST',headers,body:JSON.stringify({text:'x'.repeat(66000)})});assert.equal(response.status,413);
 assert.equal(received.length,2);
 response=await fetch(url('/print3d/auth/me'));assert.equal(response.status,502);assert.equal(received.length,3);
});
