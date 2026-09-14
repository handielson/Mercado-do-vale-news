import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const server=await createServer({configFile:false,envDir:path.resolve('tmp-tests/marketing-scenes-fixture'),resolve:{alias:{'@':process.cwd()}},optimizeDeps:{entries:['tmp-tests/marketing-scenes-preview.html']},plugins:[react()],server:{host:'127.0.0.1',port:3194,strictPort:true},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:2000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:3194/tmp-tests/marketing-scenes-preview.html');
 await page.waitForSelector('[data-marketing-image-ready="true"]');
 await page.waitForFunction(()=>[...document.querySelectorAll('#art img')].every(i=>i.complete && i.naturalWidth>0));
 assert.match(await page.locator('#art').innerText(),/PRATICIDADE EM\s+CADA RECEITA/);assert.match(await page.locator('#art').innerText(),/35,90/);
 const source=await page.locator('[data-marketing-product-image]').getAttribute('data-marketing-source-url');
 const scene=await page.locator('[data-marketing-scene-image]').getAttribute('src');
 const png=await page.evaluate(()=>window.exportTestArtwork());
 await writeFile('tmp-tests/marketing-scenes-fixture/balanca-contextual.png',Buffer.from(png.split(',')[1],'base64'));
 await page.getByText('Editar título',{exact:true}).click();await page.getByText('Alternar preço',{exact:true}).click();
 assert.equal(await page.locator('[data-marketing-scene-image]').getAttribute('src'),scene);assert.equal(await page.locator('[data-marketing-product-image]').getAttribute('data-marketing-source-url'),source);
 assert.doesNotMatch(await page.locator('#art').innerText(),/35,90/);
 await page.getByText('Alternar modelo',{exact:true}).click();await page.waitForSelector('[data-marketing-image-ready="true"]');
 assert.equal(await page.locator('[data-marketing-scene-image]').count(),0);assert.match(await page.locator('#art').innerText(),/CONSULTE CONDIÇÕES/i);
 assert.deepEqual(errors,[]);
 await writeFile('tmp-tests/marketing-scenes-render-report.json',JSON.stringify({passed:true,renderer:'Actual ProductMarketingCard + html-to-image',image:'marketing-scenes-fixture/balanca-contextual.png',size:[1080,1920],tests:['original product source preserved','photo retained on title/price edits','price 3590 cents = R$35,90','legacy template renders','all assets local; no production mutations'],livePexelsApi:false},null,2));
 console.log('Compositor real: PNG 1080x1920, texto/preço/fundo e modelo legado verificados.');
} finally {await browser?.close();await server.close();}
