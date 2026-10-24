import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'mdv-family-ean-'));
await build({ configFile: 'vite.config.ts', root: process.cwd(), build: { outDir: out, emptyOutDir: true,
    rollupOptions: { input: 'tmp-tests/product-family-ean-preview.html' } } });
const server = await preview({ configFile: false, root: out, build: { outDir: '.' }, preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/product-family-ean-preview.html`);
    const input = page.getByPlaceholder('7891234567890').first();
    await input.pressSequentially('7891234567890');
    assert.equal(await input.inputValue(), '7891234567890');
    assert.equal(await page.getByTestId('ean-state').innerText(), '["7891234567890"]');
    assert.ok(Number(await page.getByTestId('render-tick').innerText()) > 0, 'A edição precisa continuar a marcar o rascunho como alterado');
    assert.deepEqual(errors, []);
    console.log('Family EAN browser typing passed');
} finally {
    await browser?.close();
    await server.httpServer.close();
}
