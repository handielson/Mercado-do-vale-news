// Synthetic local fixture; no credentials, database, or external requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';

import {AccountantSaleDetailsPanel} from './components/company/AccountantSaleDetailsPanel.tsx';
import {accountantPortalService as api} from './services/accountantPortalService.ts';
const company={id:'primary',name:'Empresa de teste'};
const totals={operationalCents:900,invoicedCents:900,noInvoiceConfirmedCents:0,reconciliationPendingCents:0,cancelledCents:0,operationalPendingCents:0};
api.list=async()=>({companies:[company]});
api.revenue=async()=>({company,coverage:{available:true},totals,documentTotals:{authorizedDocumentCents:900,cancelledDocumentCents:0},months:[],reviewSales:[],documents:[],sales:[{channel:'pdv',externalSaleId:'22222222-2222-4222-8222-222222222222',occurredAt:'2026-09-24',fiscalState:'invoiced',totalCents:900}]});
api.saleDetails=async()=>({channel:'pdv',customerName:'Cliente teste',status:'success',paymentStatus:'paid',items:[{name:'Cabo USB-C de teste',sku:'SKU-01',quantity:2,unitPriceCents:500,totalCents:900}],payments:[{method:'pix',amountCents:900}],totalCents:900,subtotalCents:1000,discountCents:100,shippingCents:0,documents:[],receipt:{number:'123',series:'1',status:'authorized',authorizedAt:'2026-09-24T12:00:00Z',available:true}});
api.saleReceipt=async(id,sale,format)=>({filename:'cupom-teste.'+format,mimeType:format==='pdf'?'application/pdf':'application/xml',base64:btoa(format==='pdf'?'%PDF-1.4 fixture':'<nfeProc/>')});
function Fixture(){const [open,setOpen]=React.useState(false);return React.createElement('div',null,React.createElement('button',{onClick:()=>setOpen(!open)},open?'Fechar detalhes':'Ver venda'),open?React.createElement(AccountantSaleDetailsPanel,{companyId:'primary',channel:'pdv',saleId:'sale'}):null);}createRoot(document.getElementById('root')).render(React.createElement(Fixture));`;
const bundled=await build({configFile:false,envDir:false,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',enforce:'pre',resolveId(id){if(id.endsWith('sale-fixture.jsx'))return process.cwd().replaceAll('\\','/')+'/sale-fixture.jsx';},load(id){if(id.endsWith('sale-fixture.jsx'))return fixture;}}],build:{write:false,lib:{entry:path.join(process.cwd(),'sale-fixture.jsx'),name:'AccountantFixture',formats:['iife']},minify:false}});
const bundle=(Array.isArray(bundled)?bundled[0]:bundled).output.find(file=>file.type==='chunk').code;
const cssFile=readdirSync('dist/assets').find(name=>/^index-.*\.css$/.test(name));
const server=createServer((req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle);return;}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync(path.join('dist/assets',cssFile)));return;}
 res.setHeader('Content-Type','text/html');res.end('<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-slate-100"><main class="mx-auto max-w-7xl p-4"><div id="root"></div></main><script src="/app.js"></script></body></html>');
});
let browser;
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ver venda',exact:true}).click();
  await page.getByText('Cabo USB-C de teste').waitFor();
  assert.match(await page.getByRole('region',{name:'Detalhes da venda'}).innerText(),/Cupom fiscal de balcão/);
  for(const format of ['PDF','XML']) {
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar '+format,exact:true}).click();
    assert.equal((await downloaded).suggestedFilename(),'cupom-teste.'+format.toLowerCase());
  }
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-sales-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No page overflow on mobile');
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-sales-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Fechar detalhes',exact:true}).click();
  assert.equal(await page.getByText('Cabo USB-C de teste').count(),0);
  assert.deepEqual(errors,[]);console.log('Browser: sale details, PDF/XML downloads, responsive layout and close passed.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
