import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const stub = `export const catalogEntries = {
    preview: async (items) => {
        window.previewCalls ||= []; window.previewCalls.push(items);
        if (window.previewFail) throw new Error('falha');
        return window.previewResult(items);
    },
    commit: async (items, hash) => {
        window.commitCalls ||= []; window.commitCalls.push({ items, hash });
        return window.commitImpl(items, hash);
    },
    get: async () => ({ batch: {}, lines: [] }),
};`;
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {CatalogEntryPage} from '${process.cwd().replaceAll('\\', '/')}/pages/admin/entrada/CatalogEntryPage.tsx';
const initial = window.__initialEntries || ['/admin/entrada'];
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={initial}><CatalogEntryPage /></MemoryRouter>);`;

const draftLines = [
    { key: 'a', source: 'manual', label: 'Redmi 15 · 8/256 · Verde · IMEI …8763', item: { source: 'manual', name: 'Redmi 15', color: 'Verde', quantity: 1, identity: { imei1: '863715061138763' } } },
    { key: 'b', source: 'bipar', label: 'Redmi 15 · 8/256 · Verde · IMEI …8763', item: { source: 'bipar', name: 'Redmi 15', color: 'Verde', quantity: 1, identity: { imei1: '863715061138763' } } },
];

let script;
async function setup(t, { lines = draftLines, url = '/admin/entrada', init } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), {
                name: 'entrada-fixture', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0entrada-entry.tsx';
                    if (/\/catalogEntries(?:\.ts)?$/.test(id)) return '\0catalog-entries-stub';
                },
                load(id) { if (id === '\0entrada-entry.tsx') return entry; if (id === '\0catalog-entries-stub') return stub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'EntradaTest' } },
        });
        script = (Array.isArray(bundled) ? bundled[0] : bundled).output.find(i => i.type === 'chunk').code;
    }
    const server = createServer((req, res) => {
        if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(script); }
        else res.end('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(r => server.close(r)));
    const browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ lines, url, init }) => {
        window.__initialEntries = [url];
        if (lines) localStorage.setItem('mdv-entrada-rascunho-v1', JSON.stringify({ lines }));
        window.previewResult = items => ({ ok: true, hash: 'h1', plan: items.map((_, i) => ({ line: i + 1, product_id: 'p' + (i + 1), sku: 'S' + i, family: 'existing', variation: 'new', price_source: 'group', stock: { kind: 'serialized', quantity: 1 }, errors: [] })) });
        window.commitImpl = async items => ({ batch_id: 'b1', plan: items.map((_, i) => ({ line: i + 1, product_id: 'p' + (i + 1), sku: 'S' + i, family: 'existing', variation: 'new', price_source: 'group', stock: { kind: 'serialized', quantity: 1 }, errors: [] })) });
        if (init) new Function(init)();
    }, { lines, url, init });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const text = page => page.locator('body').innerText();

test('abas e lista vazia', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, { lines: null });
    for (const n of ['Manual', 'Bipar', 'Planilha', 'Foto']) await page.getByRole('tab', { name: n }).waitFor();
    assert.match(await text(page), /Nenhum item na lista/);
    await page.getByRole('tab', { name: 'Planilha' }).click();
    assert.match(await text(page), /Em breve nesta tela \(use as telas atuais por enquanto\)/);
    assert.equal(await page.locator('a[href="/admin/products/bulk"]').count(), 1);
    await page.getByRole('tab', { name: 'Foto' }).click();
    assert.equal(await page.locator('a[href="/admin/products/photo-intake"]').count(), 1);
    assert.deepEqual(errors, []);
});

test('?aba= escolhe a aba', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { lines: null, url: '/admin/entrada?aba=foto' });
    assert.equal(await page.getByRole('tab', { name: 'Foto' }).getAttribute('aria-selected'), 'true');
});

test('Conferir chama preview com 2 itens e mostra ok e selo', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(() => document.body.innerText.includes('cor nova'));
    assert.equal(await page.evaluate(() => window.previewCalls[0].length), 2);
    assert.match(await text(page), /✅/);
    assert.equal(await page.getByRole('button', { name: 'Confirmar entrada' }).isEnabled(), true);
    assert.deepEqual(errors, []);
});

test('erro de IMEI repetido bloqueia Confirmar', { timeout: 120000 }, async t => {
    const msg = 'IMEI 863715061138763 repetido no lote (linhas 1 e 2).';
    const { page } = await setup(t, {
        init: `window.previewResult = items => ({ ok:false, hash:'', plan: items.map((_, i) => ({ line:i+1, product_id:null, sku:null, family:null, variation:null, price_source:null, stock:{kind:'serialized',quantity:1}, errors:['${msg}'] })) });`,
    });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(m => document.body.innerText.split(m).length === 3, msg);
    assert.equal(await page.getByRole('button', { name: 'Confirmar entrada' }).isDisabled(), true);
});

test('Confirmar limpa lista e rascunho e mostra links', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await page.getByRole('button', { name: 'Conferir' }).click();
    const btn = page.getByRole('button', { name: 'Confirmar entrada' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Confirmar entrada') && !b.disabled));
    await btn.click();
    await page.getByText('Entrada confirmada').waitFor();
    assert.equal(await page.locator('a[href="/admin/products/p1"]').count(), 1);
    assert.equal(await page.locator('a[href="/admin/products/p2"]').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.commitCalls[0].hash), 'h1');
    assert.match(await text(page), /Nenhum item na lista/);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('mdv-entrada-rascunho-v1') || '{"lines":[]}'));
    assert.equal(draft.lines.length, 0);
});

for (const [status, msg] of [[409, 'O lote mudou desde a conferência. Confira novamente.'], [422, 'Há linhas com problema. Confira a lista.']]) {
    test(`commit ${status} mostra aviso e roda preview de novo`, { timeout: 120000 }, async t => {
        const { page } = await setup(t, { init: `window.commitImpl = async () => { throw new Error('[VPS] ${status} conflito'); };` });
        await page.getByRole('button', { name: 'Conferir' }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Confirmar entrada') && !b.disabled));
        await page.getByRole('button', { name: 'Confirmar entrada' }).click();
        await page.getByText(msg).waitFor();
        await page.waitForFunction(() => window.previewCalls.length === 2);
    });
}

test('remover linha após prévia desabilita Confirmar', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Confirmar entrada') && !b.disabled));
    await page.getByRole('button', { name: 'Remover' }).first().click();
    assert.equal(await page.getByRole('button', { name: 'Confirmar entrada' }).isDisabled(), true);
});
