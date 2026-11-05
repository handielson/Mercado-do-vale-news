import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, photoFixtures, photoServiceStubs, stubPlugin } from './entrada-fixtures.mjs';

const stub = `export const catalogEntries = {
    preview: async (items) => {
        window.previewCalls ||= []; window.previewCalls.push(items);
        if (window.previewFail) throw new Error('falha');
        return window.previewResult(items);
    },
    commit: async (items, hash, clientBatchId) => {
        window.commitCalls ||= []; window.commitCalls.push({ items, hash, clientBatchId });
        return window.commitImpl(items, hash);
    },
    get: async (id) => {
        window.getCalls ||= []; window.getCalls.push(id);
        return window.getImpl(id);
    },
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
            plugins: [react(), stubPlugin(photoServiceStubs), {
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
    await page.addInitScript(({ lines, url, init, fixtures }) => {
        window.__initialEntries = [url];
        window.fixtures = fixtures;
        if (lines) localStorage.setItem('mdv-entrada-rascunho-v1', JSON.stringify({ lines }));
        window.previewResult = items => ({ ok: true, hash: 'h1', plan: items.map((_, i) => ({ line: i + 1, product_id: 'p' + (i + 1), sku: 'S' + i, family: 'existing', variation: 'new', price_source: 'group', stock: { kind: 'serialized', quantity: 1 }, errors: [] })) });
        // Variação criada no lote: o plano da confirmação não tem id (só o lote gravado tem).
        window.commitImpl = async items => ({ batch_id: 'b1', plan: items.map((_, i) => ({ line: i + 1, product_id: null, sku: 'S' + i, family: 'existing', variation: 'new', price_source: 'group', stock: { kind: 'serialized', quantity: 1 }, errors: [] })) });
        window.getImpl = async id => ({ batch: { id }, lines: window.commitCalls.at(-1).items.map((_, i) => ({ line: i + 1, product_id: 'p' + (i + 1) })) });
        if (init) new Function(init)();
    }, { lines, url, init, fixtures: { ...defaultFixtures, ...photoFixtures } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const text = page => page.locator('body').innerText();

test('abas e lista vazia', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, { lines: null });
    for (const n of ['Manual', 'Bipar', 'Planilha', 'Foto']) await page.getByRole('tab', { name: n }).waitFor();
    assert.match(await text(page), /Nenhum item na lista/);
    await page.getByRole('tab', { name: 'Planilha' }).click();
    await page.getByRole('button', { name: 'Baixar modelo da planilha' }).waitFor();
    await page.getByRole('tab', { name: 'Foto' }).click();
    await page.getByRole('heading', { name: 'Fila de conferência' }).waitFor();
    assert.equal(await page.getByText('Em breve nesta tela').count(), 0);
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
    assert.deepEqual(await page.evaluate(() => window.getCalls), ['b1']);
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

test('durante a confirmação Remover e Adicionar ficam desabilitados e há texto para leitor de tela', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.commitImpl = () => new Promise(r => { window.finishCommit = () => r({ batch_id: 'b1', plan: [{ product_id: 'p1' }, { product_id: 'p2' }] }); });` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Confirmar entrada') && !b.disabled));
    assert.equal(await page.locator('span.sr-only', { hasText: 'OK' }).count(), 2);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.waitForFunction(() => window.finishCommit);
    for (const b of await page.getByRole('button', { name: 'Remover' }).all()) assert.equal(await b.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Adicionar à lista' }).isDisabled(), true);
    await page.evaluate(() => window.finishCommit());
    await page.getByText('Entrada confirmada').waitFor();
});

test('?modelo= pré-seleciona o modelo na aba Manual', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { lines: null, url: '/admin/entrada?modelo=m1' });
    await page.getByText('IMEI 1', { exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Modelo' }).inputValue(), 'Redmi 15');
});

const confirmReady = page => page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Confirmar entrada') && !b.disabled));
const DRAFT_ID = '11111111-2222-4333-8444-555555555555';
const draftWithId = `localStorage.setItem('mdv-entrada-rascunho-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('mdv-entrada-rascunho-v1')), clientBatchId: '${DRAFT_ID}' }));`;

test('I1: confirmação envia o clientBatchId do rascunho e troca a chave depois do sucesso', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: draftWithId });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Entrada confirmada').waitFor();
    assert.equal(await page.evaluate(() => window.commitCalls[0].clientBatchId), DRAFT_ID);
    await page.waitForFunction(id => { const d = JSON.parse(localStorage.getItem('mdv-entrada-rascunho-v1') || '{}'); return d.clientBatchId && d.clientBatchId !== id; }, DRAFT_ID);
});

test('I1: erro ambíguo avisa, confere de novo e o reenvio usa a mesma chave', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `${draftWithId} let n = 0; const ok = window.commitImpl; window.commitImpl = async (...a) => { if (n++ === 0) throw new Error('The operation was aborted due to timeout'); return ok(...a); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('A confirmação pode ter sido gravada. Confira novamente antes de reenviar.').waitFor();
    await page.waitForFunction(() => window.previewCalls.length === 2);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mdv-entrada-rascunho-v1')).lines.length), 2, 'lista continua');
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Entrada confirmada').waitFor();
    assert.deepEqual(await page.evaluate(() => window.commitCalls.map(c => c.clientBatchId)), [DRAFT_ID, DRAFT_ID]);
});

test('I1: 5xx também é ambíguo (não mostra erro cru)', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.commitImpl = async () => { throw new Error('[VPS] 502 https://api.x/catalog-entries — <html>Bad gateway</html>'); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('A confirmação pode ter sido gravada. Confira novamente antes de reenviar.').waitFor();
    assert.doesNotMatch(await text(page), /\[VPS\]/);
});

test('I1: mesma chave com outra lista mostra o aviso do servidor e gera chave nova', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `${draftWithId} let n = 0; const ok = window.commitImpl; window.commitImpl = async (...a) => { if (n++ === 0) throw new Error('[VPS] 409 https://api.x/catalog-entries — {"error":"Este envio já foi gravado com outra lista. Confira a lista antes de reenviar.","code":"client_batch_conflict"}'); return ok(...a); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Este envio já foi gravado com outra lista. Confira a lista antes de reenviar.').waitFor();
    await page.waitForFunction(() => window.previewCalls.length === 2);
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Entrada confirmada').waitFor();
    const ids = await page.evaluate(() => window.commitCalls.map(c => c.clientBatchId));
    assert.equal(ids[0], DRAFT_ID); assert.notEqual(ids[1], DRAFT_ID); assert.ok(ids[1]);
});

test('I2: replay e falha do get usam o plano como reserva para os links', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.commitImpl = async items => ({ batch_id: 'b9', replay: true, plan: items.map((_, i) => ({ line: i + 1, product_id: 'q' + (i + 1), errors: [] })) }); window.getImpl = async () => { throw new Error('[VPS] 500 x'); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Entrada confirmada').waitFor();
    assert.equal(await page.locator('a[href="/admin/products/q1"]').count(), 1);
    assert.equal(await page.locator('a[href="/admin/products/q2"]').count(), 1);
});

test('M4: erro do servidor mostra só a mensagem do JSON', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.previewFail = false; const real = window.previewResult; window.previewResult = () => { throw new Error('[VPS] 400 https://api.x/catalog-entries/preview — {"error":"Lote acima de 500 itens."}'); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.getByText('Não foi possível conferir: Lote acima de 500 itens.').waitFor();
    assert.doesNotMatch(await text(page), /\[VPS\]|https:|\{"error"/);
});

test('M4: 400 na confirmação mostra só a mensagem e não reenvia prévia', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.commitImpl = async () => { throw new Error('[VPS] 400 https://api.x/catalog-entries — {"error":"client_batch_id inválido."}'); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await confirmReady(page);
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.getByText('Não foi possível confirmar: client_batch_id inválido.').waitFor();
    assert.equal(await page.evaluate(() => window.previewCalls.length), 1);
});

test('T2: remover linha limpa o aviso de erro', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: `window.previewResult = () => { throw new Error('[VPS] 400 https://api.x — {"error":"Falhou"}'); };` });
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.getByText('Não foi possível conferir: Falhou').waitFor();
    await page.getByRole('button', { name: 'Remover' }).first().click();
    await page.waitForFunction(() => !document.body.innerText.includes('Não foi possível conferir'));
    assert.equal(await page.getByRole('alert').count(), 0);
});
