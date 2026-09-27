const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseUrl = process.env.PRINT3D_TEST_BASE_URL || 'http://127.0.0.1:3000';
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 let apiCalls=0;
 let disabledProbe=true;
 await context.route('**/*', route => {
   const url=new URL(route.request().url());
   if(url.hostname==='api.xiaomipetrolina.com.br' || url.pathname.includes('vps-proxy') || url.pathname.startsWith('/api/')) {
     if(disabledProbe && decodeURIComponent(url.href).includes('/admin/print3d/production') && route.request().method()==='GET') {
       return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:false,jobs:[]})});
     }
     if (decodeURIComponent(url.href).includes('/print3d/production')) apiCalls++;
     return route.abort();
   }
   return url.hostname==='127.0.0.1' ? route.continue() : route.abort();
 });
 const admin=await context.newPage();
 await admin.goto(`${baseUrl}/tmp-tests/print3d-production-preview.html?view=admin`);
 await admin.getByRole('heading',{name:'Produção real ainda não habilitada'}).waitFor();
 assert.equal(await admin.getByRole('alert').count(),0);
 assert.equal(await admin.getByText('Nenhuma ordem de produção encontrada.',{exact:false}).count(),0);
 await admin.getByRole('button',{name:'Testar simulação de produção'}).click();
 await admin.getByRole('button',{name:'Reiniciar exemplo em 20 de 100'}).waitFor();
 disabledProbe=false;
 await admin.goto(`${baseUrl}/tmp-tests/print3d-production-preview.html?view=admin&demo=1`);
 await admin.getByRole('button',{name:'Reiniciar exemplo em 20 de 100'}).click();
 assert.equal(await admin.getByRole('progressbar').getAttribute('aria-valuenow'),'20');
 await admin.getByLabel('Novas aprovadas',{exact:true}).fill('20');
 await admin.getByLabel('Novas reprovadas',{exact:true}).fill('2');
 await admin.getByLabel('Consumo de PLA Areia em gramas').fill('35');
 await admin.getByLabel('Observação interna').fill('NOTA INTERNA PRIVADA');
 await admin.getByRole('button',{name:'Registrar produção',exact:true}).click();
 await admin.getByRole('status').filter({hasText:'40 de 100'}).waitFor();
 assert.equal(await admin.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
 await admin.screenshot({path:'C:/Users/Nitro/.codex/visualizations/2026/09/25/01a0d7e9-06df-7743-aa77-6b4637f66647/producao-admin.png',fullPage:true});
 const customer=await context.newPage();
 await customer.goto(`${baseUrl}/loja-3d/conta/producao?demo=1`);
 await customer.getByText('Faltam 60 unidades para concluir a produção.').waitFor();
 assert.equal(await customer.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
 await customer.getByText('Histórico de produção',{exact:true}).click();
 assert.equal(await customer.getByText('NOTA INTERNA PRIVADA').count(),0);
 assert.equal(await customer.getByText(/reprovadas/i).count(),0);
 await customer.screenshot({path:'C:/Users/Nitro/.codex/visualizations/2026/09/25/01a0d7e9-06df-7743-aa77-6b4637f66647/producao-cliente.png',fullPage:true});
 await admin.getByLabel('Novas aprovadas',{exact:true}).fill('61');
 await admin.getByRole('button',{name:'Registrar produção',exact:true}).click();
 assert.equal(await admin.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
 await admin.getByLabel('Novas aprovadas',{exact:true}).fill('60');
 await admin.getByLabel('Consumo de PLA Areia em gramas').fill('35');
 await admin.getByRole('button',{name:'Registrar produção',exact:true}).click();
 await admin.getByRole('status').filter({hasText:'100 de 100'}).waitFor();
 await customer.getByRole('button',{name:'Atualizar',exact:true}).click();
 await customer.getByText('Todas as unidades foram produzidas e aprovadas.').waitFor();
 assert.equal(await customer.getByRole('progressbar').getAttribute('aria-valuenow'),'100');
 assert.equal(apiCalls,0);
 console.log('PASS: admin20->40->100, rejeitos separados, limite100, cliente isolado e atualizado; zero API de produção na demo e demais APIs bloqueadas.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
