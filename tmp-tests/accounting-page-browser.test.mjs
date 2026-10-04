import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

test('Contabilidade: período fechado, sem duplicar notas, override por competência, erros e respostas atrasadas', { timeout: 60000 }, async t => {
    const stub = `export const accountantPortalService = {
        list: async () => ({ enabled:true, companies:[{id:'primary',regime:window.regime || 'simples_nacional'}] }),
        revenue: async (id,from,to) => {
            window.calls ||= []; window.calls.push({id,from,to});
            if(window.fail) throw new Error('Falha simulada');
            const delay = window.delays?.[from] || 0; if(delay) await new Promise(r=>setTimeout(r,delay));
            const previous = from.slice(0,7)!==to.slice(0,7);
            const sale = {channel:'pdv',externalSaleId:'sale-1',operationalState:'completed',fiscalState:'invoiced',occurredAt:to,totalCents:previous?22434874:100000};
            return { period:{from,to},coverage:{available:true},months:[{competence:to.slice(0,7)}],
                sales:[sale,{...sale,externalSaleId:'cancel',operationalState:'cancelled',totalCents:99999999}],
                documents:[{issuedAt:to,model:'65',status:'authorized',totalCents:sale.totalCents}] };
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
    assert.match(await result.innerText(), /224\.348,74/);
    assert.match(await result.innerText(), /2ª faixa/);
    assert.match(await result.innerText(), /4\.65%/);
    assert.match(await page.getByRole('note').innerText(), /10\/2025/);
    assert.match(await page.getByRole('note').innerText(), /cobertura não confirmada/);
    assert.deepEqual((await page.evaluate(()=>window.calls)).slice(-2),[
        {id:'primary',from:'2025-10-01',to:'2026-09-30'},
        {id:'primary',from:'2026-10-01',to:'2026-10-31'},
    ]);
    const input=page.getByRole('textbox',{name:'RBT12 confirmado pelo contador (opcional)'});
    await input.fill('1500000,00');await input.blur();
    assert.match(await result.innerText(), /4ª faixa/);
    await input.fill('4000000,00');await input.blur();
    assert.match(await result.innerText(), /6ª faixa/);
    assert.match(await page.getByRole('alert').innerText(), /sublimite/);
    await input.fill('4800000,01');await input.blur();
    assert.match(await result.innerText(), /Indisponível/);
    assert.match(await page.getByRole('alert').innerText(), /cálculo bloqueado/);
    await month.fill('2026-09');await result.waitFor();
    assert.match(await result.innerText(), /224\.348,74/);
    assert.equal(await input.inputValue(),'');
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
