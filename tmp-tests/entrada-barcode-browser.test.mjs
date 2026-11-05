import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, photoFixtures, photoServiceStubs, stubPlugin } from './entrada-fixtures.mjs';

// Review Focus 5 (etapa 6): "Buscar produto por código de barras ou SKU" na Entrada substitui o
// antigo Cadastro rápido por EAN. Achou → prende a variação (?variacao=); não achou → mensagem com link.
const root = process.cwd().replaceAll('\\', '/');
const catalogStub = `export const catalogEntries = { preview: async () => ({ ok: true, hash: 'h', plan: [] }), commit: async () => ({}), get: async () => null };`;
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {CatalogEntryPage} from '${root}/pages/admin/entrada/CatalogEntryPage.tsx';
function Probe() { const loc = useLocation(); window.__path = loc.pathname; window.__search = loc.search; window.__state = loc.state; return null; }
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.__url]}><Probe /><CatalogEntryPage /></MemoryRouter>);`;

let script;
async function setup(t, url = '/admin/entrada?aba=bipar', { init } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(photoServiceStubs), {
                name: 'entry', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0barcode-entry.tsx';
                    if (/\/catalogEntries(?:\.ts)?$/.test(id)) return '\0catalog-entries-stub';
                },
                load(id) { if (id === '\0barcode-entry.tsx') return entry; if (id === '\0catalog-entries-stub') return catalogStub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'BarcodeTest' } },
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
    page.setDefaultTimeout(5000);
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ url, fixtures, init }) => {
        window.__url = url;
        window.fixtures = fixtures;
        if (init) new Function(init)();
    }, { url, fixtures: { ...defaultFixtures, ...photoFixtures }, init });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const FIELD = 'Buscar produto por código de barras ou SKU';
const NOT_FOUND = 'Produto não encontrado. Cadastre em Produtos → Novo produto.';
const PARENT = 'Este é o produto pai da família. Escolha a variação (cor/memória).';
const text = page => page.locator('body').innerText();
const selected = async (page, name) => (await page.getByRole('tab', { name }).getAttribute('aria-selected')) === 'true';
const search = page => page.evaluate(() => window.__search);
async function lookup(page, code) {
    const field = page.getByLabel(FIELD);
    await field.fill(code);
    await field.press('Enter');
}

test('EAN de celular: prende a variação e a página escolhe Bipar (sem ?aba=)', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await lookup(page, '7891234567890');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await search(page), '?variacao=p1');
    assert.equal(await selected(page, 'Bipar'), true);
    assert.match(await text(page), /RED15-8-256-VD/);
    assert.equal(await page.getByLabel(FIELD).count(), 0, 'com variação fixa o campo de busca sai');
    assert.deepEqual(await page.evaluate(() => window.lookupCalls), ['7891234567890']);
    assert.deepEqual(errors, []);
});

test('EAN alternativo também acha; acessório abre Manual', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await lookup(page, ' 7890000000017 ');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await search(page), '?variacao=p4');
    assert.equal(await selected(page, 'Manual'), true);
    assert.match(await text(page), /CAPA-SIL/);
    assert.deepEqual(await page.evaluate(() => window.lookupCalls), ['7890000000017'], 'busca sem espaços');
    assert.deepEqual(errors, []);
});

test('SKU exato acha a variação', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await lookup(page, 'RED-OLD');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await search(page), '?variacao=p3');
    assert.equal(await selected(page, 'Bipar'), true);
});

test('não achou: mensagem com link para Novo produto levando o EAN', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await lookup(page, '7890000000000');
    await page.getByText(NOT_FOUND).waitFor();
    const link = page.getByRole('link', { name: 'Novo produto' });
    assert.equal(await link.getAttribute('href'), '/admin/products/new');
    assert.equal(await search(page), '?aba=bipar', 'não sai da tela');
    await link.click();
    await page.waitForFunction(() => window.__path === '/admin/products/new');
    assert.deepEqual(await page.evaluate(() => window.__state), { ean: '7890000000000' });
    assert.deepEqual(errors, []);
});

test('não achou um SKU: o link não leva o código como EAN', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await lookup(page, 'SKU-INEXISTENTE');
    await page.getByText(NOT_FOUND).waitFor();
    await page.getByRole('link', { name: 'Novo produto' }).click();
    await page.waitForFunction(() => window.__path === '/admin/products/new');
    assert.equal(await page.evaluate(() => window.__state), null);
});

test('EAN do produto pai: avisa na hora e não prende nada', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await lookup(page, '7895555555555');
    await page.getByText(PARENT).waitFor();
    assert.equal(await search(page), '?aba=bipar');
});

test('EAN de mais de uma variação: o operador escolhe', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await lookup(page, '7899999999999');
    await page.getByRole('button', { name: /Poco X8/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Fone Bluetooth/ }).count(), 1);
    assert.equal(await search(page), '?aba=bipar');
    await page.getByRole('button', { name: /Fone Bluetooth/ }).click();
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await search(page), '?variacao=p7');
});

test('falha na busca mostra erro, não "não encontrado"', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?aba=bipar', { init: 'window.lookupFail = true;' });
    await lookup(page, '7891234567890');
    await page.getByText('Não foi possível buscar o produto. Tente de novo.').waitFor();
    assert.equal(await page.getByText(NOT_FOUND).count(), 0);
});

test('o campo aparece também na aba Manual e some em Planilha/Foto', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada');
    await page.getByLabel(FIELD).waitFor();
    await page.getByRole('tab', { name: 'Planilha' }).click();
    await page.getByRole('button', { name: 'Baixar modelo da planilha' }).waitFor();
    assert.equal(await page.getByLabel(FIELD).count(), 0);
});
