import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { rolldown } from 'rolldown';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

// Synthetic terms only. No sale, customer, production API or printer is touched.
const output = mkdtempSync(path.join(os.tmpdir(), 'mdv-warranty-assets-'));
const entry = path.join(output, 'entry.ts');
const sourcePath = file => JSON.stringify(path.resolve(file).replaceAll('\\', '/'));
writeFileSync(entry, `
    import { printDocumentWhenReady, waitForDocumentAssets } from ${sourcePath('utils/documentPrintAssets.ts')};
    import { generateExistingWarrantyTermPdfBase64 } from ${sourcePath('utils/warrantyPdfGenerator.ts')};
    Object.assign(window, { printDocumentWhenReady, waitForDocumentAssets, generateExistingWarrantyTermPdfBase64 });
`);
const bundle = await rolldown({ input: entry, platform: 'browser' });
const { output: chunks } = await bundle.generate({ format: 'iife', codeSplitting: false });
await bundle.close();
const js = chunks.find(chunk => chunk.type === 'chunk').code;
const server = createServer((req, res) => {
    if (req.url === '/test-bundle.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(js);
    } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><main id="term"></main><script src="/test-bundle.js"></script></body></html>');
    }
});
let browser;
const logo = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="70"><rect width="180" height="70" fill="#173ea5"/><text x="12" y="43" font-size="24" fill="white">LOGO TESTE</text></svg>';
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    console.log('Warranty test: server ready');
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('Warranty test: browser ready');
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('Browser:', error.message));
    const network = [];
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') return route.abort();
        if (url.pathname.endsWith('logo.svg')) {
            network.push({ path: url.pathname, query: url.search, type: route.request().resourceType() });
            await new Promise(resolve => setTimeout(resolve, 3250));
            return route.fulfill({ contentType: 'image/svg+xml', body: logo });
        }
        if (url.pathname === '/broken.svg') return route.fulfill({ status: 404, body: '' });
        return route.continue();
    });
    await page.goto(`${base}/__warranty-assets-test`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.printDocumentWhenReady === 'function');
    console.log('Warranty test: modules ready');

    await page.evaluate(() => {
        document.querySelector('#term').innerHTML = '<img src="/slow-logo.svg"><p>Termo de teste</p>';
        window.printCalls = 0;
        window.pendingPrint = window.printDocumentWhenReady({ document, closed: false, focus() {}, print() {
            if (!document.querySelector('img').naturalWidth) throw Error('Logo absent at print');
            window.printCalls++;
        } });
    });
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.printCalls), 0, 'print must wait for a slow uncached logo');
    await page.evaluate(() => window.pendingPrint);
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    console.log('Warranty test: slow logo passed');

    const broken = await page.evaluate(async () => {
        document.querySelector('#term').innerHTML = '<img src="/broken.svg">';
        try {
            await window.printDocumentWhenReady({ document, closed: false, focus() {}, print() { window.printCalls++; } });
            return null;
        } catch (e) { return e.message; }
    });
    assert.match(broken, /imagem.*não carregou/);
    assert.equal(await page.evaluate(() => window.printCalls), 1, 'broken image must not open print');
    assert.match(await page.evaluate(async () => {
        // A failed image is complete=true and must still fail on a subsequent attempt.
        try { await window.waitForDocumentAssets(document); return ''; } catch (e) { return e.message; }
    }), /imagem.*não carregou/);

    assert.match(await page.evaluate(async () => {
        document.querySelector('#term').innerHTML = '<img src="/timeout-logo.svg">';
        try { await window.waitForDocumentAssets(document, 60); return ''; } catch (e) { return e.message; }
    }), /imagem.*não carregou/);
    assert.match(await page.evaluate(async () => {
        try {
            await window.waitForDocumentAssets({ nodeType: 9, fonts: { ready: new Promise(() => {}) }, querySelectorAll: () => [] }, 60);
            return '';
        } catch (e) { return e.message; }
    }), /fontes.*não carregaram/);

    await page.evaluate(() => { document.querySelector('#term').innerHTML = ''; });
    const pdfBase64 = await page.evaluate(async () => window.generateExistingWarrantyTermPdfBase64({
        warrantyContents: ['<img src="/pdf-logo.svg" style="width:180px;height:70px"><h1>Termo de garantia - teste</h1><p>Documento sintético sem dados pessoais.</p><p>Assinatura do Cliente</p>'],
    }));
    console.log('Warranty test: PDF generated');
    const bytes = Buffer.from(pdfBase64, 'base64');
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 2, 'both warranty copies must survive');
    assert.equal(network.filter(x => x.path === '/pdf-logo.svg' && x.type === 'fetch').length, 1,
        'embed the logo once for both PDF copies');
    assert.ok(network.every(x => !x.query), 'do not cache-bust the logo during capture');
    const pdfFile = path.join(output, 'warranty-logo-test.pdf');
    writeFileSync(pdfFile, bytes);
    assert.equal(await page.locator('div[style*="-10000px"]').count(), 0, 'PDF host cleaned up');
    await assert.rejects(page.evaluate(() => window.generateExistingWarrantyTermPdfBase64({
        warrantyContents: ['<img src="/broken.svg"><p>Termo inválido</p>'],
    })), /imagem.*não carregou/);

    for (const file of ['components/warranty/WarrantyTermModal.tsx', 'components/admin/sales/SaleDetailsModal.tsx',
        'pages/customers/CustomerDetailsPage.tsx', 'components/customer/profile/PurchaseHistoryTab.tsx']) {
        const source = readFileSync(file, 'utf8');
        assert.match(source, /await printDocumentWhenReady\(/, `${file} must use the shared readiness gate`);
    }
    console.log(JSON.stringify({ passed: true, pdfFile, pages: 2,
        checks: ['slow logo >3s', 'print waits for decode', 'broken/cached-broken image blocks print',
            'image and font timeouts', 'PDF embeds logo once', 'two PDF copies', 'failed PDF throws', 'all warranty entrypoints'] }));
} finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
