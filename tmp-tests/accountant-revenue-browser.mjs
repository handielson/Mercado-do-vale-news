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
api.revenue=async(id,from,to)=>({company,period:{from,to},coverage:{available:true},totals,documentTotals:{authorizedDocumentCents:1400,cancelledDocumentCents:700},months:[],reviewSales:[],documents:[{id:'d1',model:'65',status:'authorized',issuedAt:'2026-09-10',totalCents:900},{id:'d2',model:'55',status:'authorized',issuedAt:'2026-09-10',totalCents:500},{id:'d3',model:'55',status:'cancelled',issuedAt:'2026-09-10',totalCents:700}],sales:[{channel:'pdv',externalSaleId:'sale1',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'invoiced',authorizedModels:['65'],totalCents:900},{channel:'pdv',externalSaleId:'sale2',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'no_invoice_confirmed',totalCents:200},{channel:'pdv',externalSaleId:'sale3',operationalState:'completed',occurredAt:'2026-09-10',fiscalState:'reconciliation_pending',totalCents:100}]});
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
  assert.match(await summary.innerText(),/14,00/);
  for (const [filter,amount] of [['nfe','5,00'],['nfce','9,00'],['no_invoice','2,00'],['pending','1,00'],['all','12,00']]) {
    await page.getByLabel('Mostrar faturamento').selectOption(filter);
    assert.match(await summary.innerText(),new RegExp(amount));
  }
  await page.getByLabel('De',{exact:true}).fill('2020-01-01');
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  await summary.getByText(/01\/01\/2020/).waitFor();
  await page.getByRole('button',{name:'Últimos 12 meses',exact:true}).click();
  await summary.getByText(/01\/10\/2025/).waitFor();
  await page.getByLabel('Mostrar faturamento').selectOption('fiscal');
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-revenue-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.screenshot({path:path.join(os.tmpdir(),'accountant-revenue-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Browser: 12-month default, all revenue filters, arbitrary period and responsive layout passed.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
