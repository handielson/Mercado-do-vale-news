// Local fixture with in-memory persistence: no database or production requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { taxValidationView, normalizeTaxValidation, applyOperationReviews } = require('../services/fiscalTaxValidationCore.cjs');
let row = null;
let failNextSave = false;
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import '/index.css';
import {CompanyTaxValidationPanel} from '/components/company/CompanyTaxValidationPanel.tsx';
const api={list:async()=>({companies:[{id:'test',name:'Empresa de demonstração',cnpj:'',regime:'simples_nacional',crt:'1',effectiveFrom:''}]}),
taxValidation:async()=>fetch('/fixture-data').then(r=>r.json()),
saveTaxValidation:async(id,data)=>{const r=await fetch('/fixture-data',{method:'PUT',body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.message);return result;}};
createRoot(document.getElementById('root')).render(React.createElement(CompanyTaxValidationPanel,{api}));`;
let browser;
const server = await createServer({configFile:false,envDir:false,logLevel:'error',optimizeDeps:{entries:[],include:['react','react-dom/client','react/jsx-dev-runtime']},server:{host:'127.0.0.1',port:0},plugins:[{
  name:'operation-review-fixture',
  configureServer(s){s.middlewares.use(async(req,res,next)=>{
    if(req.url==='/fixture-data'){
      res.setHeader('Content-Type','application/json');
      if(req.method==='PUT'){
        if(failNextSave){failNextSave=false;res.statusCode=409;res.end(JSON.stringify({message:'Conflito de teste: recarregue antes de salvar.'}));return;}
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const body=JSON.parse(Buffer.concat(chunks).toString());
        const data=applyOperationReviews(normalizeTaxValidation(body),row,body.reviewRuleId,'test-user');
        row={status:data.status,reviewer_name:data.reviewerName,reviewer_registration:data.reviewerRegistration,reviewed_at:data.reviewedAt,notes:data.notes,rules_json:JSON.stringify(data),version:(row?.version||0)+1};
      }
      res.end(JSON.stringify(taxValidationView(row)));return;
    }
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/','<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="bg-slate-100"><main class="mx-auto max-w-6xl p-4"><div id="root"></div></main><script type="module" src="/review-fixture.jsx"></script></body></html>'));return;}
    next();
  });},
  resolveId(id){if(id==='/review-fixture.jsx')return '\0review-fixture.jsx';},
  load(id){if(id==='\0review-fixture.jsx')return fixture;}
}]});
try {
  await server.listen();
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  const first=page.getByRole('article',{name:/^OP01/});
  const second=page.getByRole('article',{name:/^OP02/});
  await first.getByRole('button',{name:'Salvar como revisado'}).click();
  await first.getByRole('alert').waitFor();
  assert.match(await first.getByRole('alert').innerText(),/Responsável/);
  await page.getByLabel('Responsável/contador',{exact:true}).fill('Contador demonstração');
  await first.getByRole('button',{name:'Salvar como revisado'}).click();
  await first.getByRole('button',{name:'Revisão salva',exact:true}).waitFor();
  assert.match(await first.innerText(),/Contador demonstração/);
  assert.equal(await first.locator('time').count(),1);
  assert.match(await second.innerText(),/Revisão pendente/);
  assert.notEqual(await first.evaluate(e=>getComputedStyle(e).backgroundColor),await second.evaluate(e=>getComputedStyle(e).backgroundColor));
  await page.reload();
  await first.getByRole('button',{name:'Revisão salva',exact:true}).waitFor();
  await first.getByLabel('CFOP',{exact:true}).fill('5103');
  assert.match(await first.innerText(),/Alterada — revisar novamente/);
  failNextSave=true;
  await first.getByRole('button',{name:'Salvar como revisado'}).click();
  await first.getByRole('alert').waitFor();
  assert.match(await first.getByRole('alert').innerText(),/Conflito/);
  assert.equal(await first.getByLabel('CFOP',{exact:true}).inputValue(),'5103');
  await first.getByRole('button',{name:'Salvar como revisado'}).click();
  await first.getByRole('button',{name:'Revisão salva',exact:true}).waitFor();
  await second.getByRole('button',{name:'Salvar como revisado'}).click();
  await second.getByRole('button',{name:'Revisão salva',exact:true}).waitFor();
  assert.match(await page.innerText('body'),/2 de 10 revisadas/);
  await page.getByLabel('CRT',{exact:true}).fill('2');
  assert.match(await second.innerText(),/Alterada — revisar novamente/);
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await page.getByText('Validação contábil salva.',{exact:true}).waitFor();
  await page.reload();
  await second.getByText('Alterada — revisar novamente',{exact:true}).waitFor();
  // Leave a representative persisted review for the visual snapshot.
  await first.getByRole('button',{name:'Salvar como revisado'}).click();
  await first.getByRole('button',{name:'Revisão salva',exact:true}).waitFor();
  await first.scrollIntoViewIfNeeded();
  if(process.env.REVIEW_SCREENSHOT)await page.screenshot({path:process.env.REVIEW_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No mobile horizontal overflow');
  assert.deepEqual(errors,[]);
  console.log('PASS: alternating cards, reviewer required, save/reload, independent reviews, stale reviews, failed save, mobile layout.');
} finally {await browser?.close();await server.close();}
