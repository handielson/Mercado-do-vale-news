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

import {RevenuePanel} from './pages/accountant/AccountantPortalPage.tsx';
import {accountantPortalService as api} from './services/accountantPortalService.ts';
const company={id:'primary',name:'Empresa de teste'};
const totals={operationalCents:1200,invoicedCents:900,noInvoiceConfirmedCents:200,reconciliationPendingCents:100,cancelledCents:0,operationalPendingCents:0};
api.list=async()=>({companies:[company]});
api.revenue=async(id,from,to)=>({company,period:{from,to},coverage:{available:true},totals,documentTotals:{authorizedDocumentCents:1400,authorizedDocumentCount:2,cancelledDocumentCents:700},months:[],reviewSales:[],documents:[{id:'d1',model:'65',channel:'pdv',status:'authorized',issuedAt:'2026-09-10',totalCents:900,fileAvailable:true},{id:'d2',model:'55',channel:'shopee',status:'authorized',issuedAt:'2026-09-12',totalCents:500,fileAvailable:true},{id:'d3',model:'55',channel:'shopee',status:'cancelled',issuedAt:'2026-09-09',totalCents:700,fileAvailable:false}],sales:[{channel:'pdv',externalSaleId:'sale1',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'invoiced',authorizedModels:['65'],totalCents:900},{channel:'pdv',externalSaleId:'sale2',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'no_invoice_confirmed',totalCents:200},{channel:'pdv',externalSaleId:'sale3',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'reconciliation_pending',totalCents:100}]});
api.saleDetails=async()=>({customerName:'Cliente de teste',status:'completed',paymentStatus:'paid',totalCents:900,subtotalCents:900,discountCents:0,shippingCents:0,items:[{name:'Produto',sku:'SKU',quantity:1,unitPriceCents:900,totalCents:900}],payments:[],documents:[],receipt:null});
api.documentFile=async()=>({filename:'nota.pdf',mimeType:'application/pdf',base64:btoa('%PDF-1.4\\n')});
api.documentReview=async(id,documentId)=>({document:{id:documentId,model:documentId==='d1'?'65':'55',number:'10',orderReference:'sale1'},review:{reviewState:'draft',valueTreatment:'',fiscalAction:'pending',justification:'',evidenceNotes:'',reviewerName:'',reviewerRegistration:'',reviewedAt:null,version:0}});
api.sefazStatus=async()=>({cStat:'100',reason:'Autorizado o uso da NF-e',checkedAt:'2026-09-24T12:00:00Z'});
createRoot(document.getElementById('root')).render(React.createElement(RevenuePanel));`;
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
  await page.clock.install({time:new Date('2026-09-24T12:00:00Z')});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  const summary=page.getByRole('region',{name:'Somatório do faturamento'});
  await summary.waitFor();
  assert.equal(await page.getByLabel('De',{exact:true}).inputValue(),'2025-10-01');
  assert.equal(await page.getByLabel('Até',{exact:true}).inputValue(),'2026-09-24');
  assert.equal(await page.getByLabel('Mostrar faturamento').inputValue(),'fiscal');
  assert.match(await page.getByRole('note').innerText(),/09\/09\/2026 a 12\/09\/2026/);
  assert.match(await summary.innerText(),/14,00/);
  assert.match(await page.getByText(/Mostrando 3 de 3 nota/).innerText(),/3 de 3/);
  for (const [filter,amount] of [['nfe','5,00'],['nfce','9,00'],['no_invoice','2,00'],['pending','1,00'],['all','12,00'],['fiscal','14,00']]) {
    await page.getByLabel('Mostrar faturamento').selectOption(filter);
    assert.match(await summary.innerText(),new RegExp(amount));
  }
  await page.getByLabel('De',{exact:true}).fill('2020-01-01');
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await summary.getByText(/01\/01\/2020/).waitFor();
  await page.getByRole('button',{name:'Últimos 12 meses',exact:true}).click();
  await summary.getByText(/01\/10\/2025/).waitFor();
  await page.getByLabel('Mostrar faturamento').selectOption('all');
  await page.getByRole('button',{name:'Ver detalhes'}).first().click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'Ver detalhes'}).first().click();
  await page.getByRole('dialog').getByRole('button',{name:'Fechar ×'}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByLabel('Buscar venda').fill('sale2');
  assert.match(await page.getByText(/Mostrando 1 de 1 venda/).innerText(),/1 de 1/);
  await page.getByLabel('Buscar nota').fill('NFC-e');
  assert.match(await page.getByText(/Mostrando 1 de 1 nota/).innerText(),/1 de 1/);
  await page.getByRole('button',{name:/NFC-e.*Abrir nota/}).click();
  const noteDrawer=page.getByRole('dialog',{name:/NFC-e/});
  await noteDrawer.waitFor();
  await noteDrawer.getByTitle(/Prévia da NFC-e/).waitFor();
  assert.equal(await noteDrawer.getByRole('button',{name:'Consultar SEFAZ'}).count(),0);
  await noteDrawer.getByRole('button',{name:'Fechar ×'}).click();
  await page.getByLabel('Buscar nota').fill('NF-e');
  await page.getByRole('button',{name:/NF-e.*Abrir nota/}).first().click();
  const nfeDrawer=page.getByRole('dialog',{name:/NF-e/});
  await nfeDrawer.getByTitle(/Prévia da NF-e/).waitFor();
  await nfeDrawer.getByRole('button',{name:'Consultar SEFAZ'}).click();
  await nfeDrawer.getByText(/100 — Autorizado o uso/).waitFor();
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-fiscal-note-drawer.png')});
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-revenue-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-revenue-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Browser: 12-month default, all revenue filters, arbitrary period and responsive layout passed.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
