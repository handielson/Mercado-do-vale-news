import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

test('Contabilidade: somente notas autorizadas por emissão, cobertura fiscal, limites, erros e respostas atrasadas', { timeout: 60000 }, async t => {
    const stub = `export const accountantPortalService = {
        accountingHistory: async () => ({version:window.historyData?1:0,history:window.historyData||null}),
        list: async () => ({ enabled:true, companies:[{id:'primary',regime:window.regime || 'simples_nacional'}] }),
        revenue: async (id,from,to) => {
            window.calls ||= []; window.calls.push({id,from,to});
            if(window.fail) throw new Error('Falha simulada');
            const delay = window.delays?.[from] || 0; if(delay) await new Promise(r=>setTimeout(r,delay));
            const previous = from.slice(0,7)!==to.slice(0,7);
            const sale = {channel:'pdv',externalSaleId:'sale-1',operationalState:'completed',fiscalState:'invoiced',occurredAt:to,totalCents:previous?22434874:100000};
            const docTotal = window.large || (previous?17002749:802179);
            return { period:{from,to},coverage:{available:true},months:[{competence:from.slice(0,7)},{competence:to.slice(0,7)}],
                sales:[sale,{...sale,externalSaleId:'cancel',operationalState:'cancelled',totalCents:99999999}],
                documents: window.noDocs ? [] : [
                    {issuedAt:to,model:'55',status:'authorized',totalCents:docTotal-10000,channel:'shopee'},
                    {issuedAt:to,model:'65',status:'authorized',totalCents:10000,channel:'pdv'},
                    {issuedAt:to,model:'55',status:'cancelled',totalCents:99999999,channel:'pdv'},
                    {issuedAt:to,model:'55',status:'draft',totalCents:99999999,channel:'pdv'},
                    {issuedAt:to,model:'57',status:'authorized',totalCents:99999999,channel:'pdv'},
                ] };
        }
    };`;
    const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import AccountingPage from '${process.cwd().replaceAll('\\','/')}/pages/admin/accounting/AccountingPage.tsx';createRoot(document.getElementById('root')).render(<MemoryRouter><AccountingPage /></MemoryRouter>);`;
    const bundled = await build({ configFile:false, logLevel:'error',
        define:{'process.env.NODE_ENV':'"production"'},
        plugins:[react(),{name:'local-fiscal-fixture',enforce:'pre',
            resolveId(id){if(id.endsWith('virtual:entry'))return '\0accounting-entry.tsx';if(/\/accountantPortalService(?:\.ts)?$/.test(id))return '\0fiscal-fixture';},
            load(id){if(id==='\0accounting-entry.tsx')return entry;if(id==='\0fiscal-fixture')return stub;},
        }],
        build:{write:false,minify:false,lib:{entry:'virtual:entry',formats:['iife'],name:'AccountingTest'}},
    });
    const script = (Array.isArray(bundled) ? bundled[0] : bundled).output.find(item=>item.type==='chunk').code;
    const server = createServer((req,res)=>{
        if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(script);}
        else res.end('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const browser = await chromium.launch({headless:true, ...(existsSync(chromium.executablePath()) ? {} : {channel:'chrome'})});
    t.after(()=>browser.close());
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
        localStorage.setItem('contabilidade_config_v2',JSON.stringify({anexo:'I',rbt12Override:3000000,diaCorte:20}));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const month=page.locator('input[type=month]');
    await month.fill('2026-10');
    const result=page.getByRole('region',{name:'Resultado do Simples Nacional'});
    try { await result.waitFor({timeout:5000}); }
    catch(e) { throw new Error(`${e.message}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`); }
    assert.match(await result.innerText(), /170\.027,49/);
    assert.match(await result.innerText(), /1ª faixa/);
    assert.match(await result.innerText(), /4\.00%/);
    assert.doesNotMatch(await result.innerText(), /224\.348,74/);
    assert.match(await page.locator('body').innerText(), /8\.021,79/);
    assert.match(await page.getByRole('note').innerText(), /10\/2025/);
    assert.match(await page.getByRole('note').innerText(), /cobertura não confirmada/);
    assert.deepEqual((await page.evaluate(()=>window.calls)).slice(-2),[
        {id:'primary',from:'2025-10-01',to:'2026-09-30'},
        {id:'primary',from:'2026-10-01',to:'2026-10-31'},
    ]);
    assert.equal(await page.getByRole('textbox',{name:'RBT12 confirmado pelo contador (opcional)'}).count(),0);
    await page.evaluate(()=>window.large=400000000);
    await page.getByRole('button',{name:'Atualizar faturamento'}).click();
    await page.getByRole('alert').waitFor();
    assert.match(await result.innerText(), /6ª faixa/);
    assert.match(await page.getByRole('alert').innerText(), /sublimite/);
    await page.evaluate(()=>window.large=480000001);
    await page.getByRole('button',{name:'Atualizar faturamento'}).click();
    await page.waitForFunction(()=>document.body.innerText.includes('cálculo bloqueado'));
    assert.match(await result.innerText(), /Indisponível/);
    assert.match(await page.getByRole('alert').innerText(), /cálculo bloqueado/);
    await page.evaluate(()=>{window.large=0;window.noDocs=true;});
    await page.getByRole('button',{name:'Atualizar faturamento'}).click();
    await page.waitForFunction(()=>document.body.innerText.replaceAll('\u00a0',' ').includes('R$ 0,00') && !document.body.innerText.includes('cálculo bloqueado'));
    assert.match(await result.innerText(), /Indisponível/);
    assert.match(await page.getByRole('note').innerText(), /Meses sem notas autorizadas registradas/);
    await page.evaluate(()=>window.noDocs=false);
    await month.fill('2026-09');await result.waitFor();
    assert.match(await result.innerText(), /170\.027,49/);
    await page.evaluate(()=>window.historyData={basis:'accrual',source:{filename:'extrato-fixture.pdf',competence:'2026-08'},
        months:Array.from({length:12},(_,i)=>({competence:new Date(Date.UTC(2025,8+i,1)).toISOString().slice(0,7),totalCents:100000})),
        declared:{rpaCents:802179,commerceCents:682179,servicesCents:120000,dasCents:34487}});
    await page.getByRole('button',{name:'Atualizar faturamento'}).click();
    await page.getByRole('region',{name:'Histórico contábil declarado'}).getByText(/extrato-fixture/).waitFor();
    assert.match(await result.innerText(), /12\.000,00/);
    assert.doesNotMatch(await result.innerText(), /170\.027,49/);
    assert.match(await page.getByRole('note').innerText(), /12 meses de histórico declarado/);
    assert.doesNotMatch(await page.getByRole('note').innerText(), /Meses sem notas/);
    assert.match(await page.locator('body').innerText(), /Serviços:.*1\.200,00/);
    assert.match(await page.locator('body').innerText(), /Notas autorizadas registradas:.*8\.021,79/);
    await page.evaluate(()=>window.historyData=null);
    await page.evaluate(()=>window.fail=true);
    await page.getByRole('button',{name:'Atualizar faturamento'}).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(),/Falha simulada/);
    await result.waitFor({state:'detached',timeout:5000});
    await page.evaluate(()=>{window.fail=false;window.delays={'2025-07-01':300};});
    await month.fill('2026-07');await month.fill('2026-08');await result.waitFor();
    await page.waitForTimeout(400);
    assert.match(await page.locator('body').innerText(),/RBT12 de 01\/08\/2025 a 31\/07\/2026/);
    await month.fill('2027-01');await page.getByRole('alert').waitFor();
    await result.waitFor({state:'detached',timeout:5000});
    await page.evaluate(()=>window.regime='lucro_presumido');
    await month.fill('2026-10');await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(),/não está cadastrada como optante/);
    assert.deepEqual(errors,[]);
});
