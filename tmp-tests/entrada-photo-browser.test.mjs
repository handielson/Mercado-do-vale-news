import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, photoFixtures, photoServiceStubs, stubPlugin } from './entrada-fixtures.mjs';

const root = process.cwd().replaceAll('\\', '/');
// Três montagens no mesmo pacote: a aba isolada, a página antiga sem props e a tela Entrada inteira.
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import {PhotoEntryTab} from '${root}/components/entrada/PhotoEntryTab.tsx';
import {SmartphonePhotoIntakePage} from '${root}/pages/admin/products/SmartphonePhotoIntakePage.tsx';
import {CatalogEntryPage} from '${root}/pages/admin/entrada/CatalogEntryPage.tsx';
import {addLines, emptyState} from '${root}/components/entrada/entryList.js';
function TabHarness() {
  const [state, setState] = React.useState(() => emptyState());
  const [confirmCount, setConfirmCount] = React.useState(0);
  window.__confirm = () => setConfirmCount(c => c + 1);
  return <PhotoEntryTab existingState={state} confirmCount={confirmCount} busy={!!window.__busy}
    onAddLines={lines => { window.added ||= []; window.added.push(...lines); setState(s => addLines(s, lines)); }} />;
}
const mode = window.__mode || 'tab';
const app = mode === 'standalone' ? <SmartphonePhotoIntakePage />
  : mode === 'page' ? <CatalogEntryPage />
  : <TabHarness />;
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.__url || '/']}>{app}</MemoryRouter>);`;

const catalogStub = `export const catalogEntries = {
    preview: async items => { window.previewCalls ||= []; window.previewCalls.push(items);
        const errs = it => (window.previewPhotoError && it.photo_intake_id ? [window.previewPhotoError] : []);
        const plan = items.map((it, i) => ({ line: i + 1, product_id: errs(it).length ? null : 'p1', sku: 'S1', family: 'existing', variation: 'existing', price_source: 'photo', stock: { kind: 'unit', quantity: 1 }, errors: errs(it) }));
        const ok = plan.every(l => !l.errors.length);
        return { ok, hash: ok ? 'h1' : '', plan }; },
    commit: async (items, hash, clientBatchId) => { window.commitCalls ||= []; window.commitCalls.push({ items, hash, clientBatchId });
        for (const it of window.fixtures.photoIntakes) if (items.some(i => i.photo_intake_id === it.id)) it.status = 'completed';
        return { batch_id: 'b1', plan: items.map((_, i) => ({ line: i + 1, product_id: 'p1', sku: 'S1', family: 'existing', variation: 'existing', price_source: 'photo', stock: { kind: 'unit', quantity: 1 }, errors: [] })) }; },
    get: async id => ({ batch: { id }, lines: [{ line: 1, product_id: 'p1' }] }),
};`;

let script;
async function setup(t, { mode = 'tab', url = '/', init } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(photoServiceStubs), {
                name: 'entry', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0photo-entry.tsx';
                    if (/\/catalogEntries(?:\.ts)?$/.test(id)) return '\0catalog-entries-stub';
                },
                load(id) { if (id === '\0photo-entry.tsx') return entry; if (id === '\0catalog-entries-stub') return catalogStub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'PhotoTest' } },
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
    page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ fixtures, mode, url, init }) => {
        window.fixtures = fixtures; window.__mode = mode; window.__url = url;
        if (init) new Function(init)();
    }, { fixtures: { ...defaultFixtures, ...photoFixtures }, mode, url, init });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const listCalls = page => page.evaluate(() => (window.photoCalls?.list || []).length);
const finalizeCalls = page => page.evaluate(() => (window.photoCalls?.finalize || []).length);
const sendButton = page => page.getByRole('button', { name: 'Enviar para a lista' });

test('a aba mostra a fila embutida, sem cabeçalho nem Voltar', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await page.getByRole('heading', { name: 'Fila de conferência' }).waitFor();
    await page.getByRole('tab', { name: 'Pendentes (1)' }).waitFor();
    await page.getByRole('tab', { name: 'Disponíveis para venda (1)' }).waitFor();
    assert.equal(await page.getByText('Cadastro de smartphones por foto').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Voltar ao cadastro em massa' }).count(), 0);
    assert.deepEqual(errors, []);
});

test('o pronto mostra "Enviar para a lista", sem SKU, e não chama finalize', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Enviar para a lista');
        return b && !b.disabled;
    });
    assert.equal(await page.getByRole('button', { name: 'Salvar e disponibilizar para venda' }).count(), 0);
    assert.equal(await page.getByText('SKU da nova variação (opcional)').count(), 0);
    await sendButton(page).click();
    const added = await page.evaluate(() => window.added);
    assert.equal(added.length, 1);
    assert.equal(added[0].source, 'foto');
    assert.deepEqual(added[0].item, { source: 'foto', photo_intake_id: 'pi-ready', location_id: 'l2' });
    assert.equal(added[0].label, 'Xiaomi · Redmi 15 · 8GB/256GB · Verde · IMEI …8763');
    await page.getByText('Adicionado à lista').waitFor();
    assert.equal(await finalizeCalls(page), 0);
    assert.deepEqual(errors, []);
});

test('enviar o mesmo pré-cadastro duas vezes não duplica a linha', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Enviar para a lista' && !x.disabled));
    await sendButton(page).click();
    await page.getByText('Adicionado à lista').waitFor();
    await sendButton(page).click();
    await page.getByText('Já está na lista').waitFor();
    assert.equal((await page.evaluate(() => window.added)).length, 1);
    assert.equal(await finalizeCalls(page), 0);
});

const enabledSend = page => page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Enviar para a lista' && !x.disabled));

test('preços não confirmados bloqueiam "Enviar para a lista"; o mesmo aparelho confirmado libera', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { init: 'window.fixtures.photoIntakes[0].prices_confirmed = 0;' });
    // Carregou o preço do grupo: "Confirmar preços" fica disponível; o envio continua bloqueado.
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Confirmar preços' && !x.disabled));
    assert.equal(await sendButton(page).isDisabled(), true);
    // Controle positivo: o mesmo pré-cadastro com preços confirmados (fila recarregada) libera o envio.
    await page.evaluate(() => { window.fixtures.photoIntakes[0].prices_confirmed = 1; window.__confirm(); });
    await enabledSend(page);
});

test('sem local o envio fica bloqueado; o local escolhido vai na linha', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await enabledSend(page);
    assert.equal(await page.getByLabel('Local').inputValue(), 'l2', 'local padrão pré-preenchido');
    await page.getByLabel('Local').selectOption('');
    await page.getByText('Escolha o local de estoque.').waitFor();
    assert.equal(await sendButton(page).isDisabled(), true);
    await page.getByLabel('Local').selectOption('l1');
    await enabledSend(page);
    await sendButton(page).click();
    assert.equal(await page.evaluate(() => window.added[0].item.location_id), 'l1');
});

test('a confirmação limpa o aviso "Adicionado à lista"', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await enabledSend(page);
    await sendButton(page).click();
    await page.getByText('Adicionado à lista').waitFor();
    await page.evaluate(() => window.__confirm());
    await page.getByText('Adicionado à lista').waitFor({ state: 'detached' });
});

test('depois de uma confirmação a fila é recarregada e mostra o aparelho concluído', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await page.getByRole('tab', { name: 'Pendentes (1)' }).waitFor();
    const before = await listCalls(page);
    assert.ok(before >= 1);
    await page.evaluate(() => { window.fixtures.photoIntakes[0].status = 'completed'; window.__confirm(); });
    await page.waitForFunction(n => (window.photoCalls?.list || []).length > n, before);
    await page.getByRole('tab', { name: 'Disponíveis para venda (2)' }).waitFor();
    await page.getByRole('tab', { name: 'Pendentes (0)' }).waitFor();
});

test('página antiga sem props: cabeçalho, Voltar e "Salvar e disponibilizar para venda" chamando finalize', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, { mode: 'standalone' });
    await page.getByText('Cadastro de smartphones por foto').waitFor();
    await page.getByRole('button', { name: 'Voltar ao cadastro em massa' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enviar para a lista' }).count(), 0);
    await page.getByText('SKU da nova variação (opcional)').waitFor();
    const save = page.getByRole('button', { name: 'Salvar e disponibilizar para venda' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Salvar e disponibilizar para venda' && !x.disabled));
    await save.click();
    await page.waitForFunction(() => (window.photoCalls?.finalize || []).length === 1);
    assert.equal(await page.evaluate(() => window.photoCalls.finalize[0].id), 'pi-ready');
    await page.getByText('Celular cadastrado com sucesso e disponível para venda.').waitFor();
    assert.deepEqual(errors, []);
});

test('tela Entrada: a aba Foto envia a linha, a confirmação usa a porta única e recarrega a fila', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, { mode: 'page', url: '/admin/entrada?aba=foto' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Enviar para a lista' && !x.disabled));
    await sendButton(page).click();
    await page.getByText('Lista de entrada (1)').waitFor();
    await page.getByText('Xiaomi · Redmi 15 · 8GB/256GB · Verde · IMEI …8763').first().waitFor();
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(() => window.previewCalls?.length === 1);
    assert.deepEqual(await page.evaluate(() => window.previewCalls[0]), [{ source: 'foto', photo_intake_id: 'pi-ready', location_id: 'l2' }]);
    const before = await listCalls(page);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Confirmar entrada' && !x.disabled));
    await page.getByRole('button', { name: 'Confirmar entrada' }).click();
    await page.waitForFunction(() => window.commitCalls?.length === 1);
    await page.waitForFunction(n => (window.photoCalls?.list || []).length > n, before);
    await page.getByRole('tab', { name: 'Disponíveis para venda (2)' }).waitFor();
    assert.equal(await finalizeCalls(page), 0);
    assert.deepEqual(errors, []);
});

const draftPhotoLine = { key: 'f1', source: 'foto', label: 'Xiaomi · Redmi 15 · 8GB/256GB · Verde · IMEI …8763', item: { source: 'foto', photo_intake_id: 'pi-ready', location_id: 'l1' } };
const withDraft = extra => `localStorage.setItem('mdv-entrada-rascunho-v1', JSON.stringify({ lines: [${JSON.stringify(draftPhotoLine)}] }));${extra || ''}`;

test('linha de foto restaurada do rascunho envia photo_intake_id e location_id na prévia', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, { mode: 'page', url: '/admin/entrada?aba=manual', init: withDraft() });
    await page.getByText('Lista de entrada (1)').waitFor();
    await page.getByRole('button', { name: 'Conferir' }).click();
    await page.waitForFunction(() => window.previewCalls?.length === 1);
    assert.deepEqual(await page.evaluate(() => window.previewCalls[0]), [{ source: 'foto', photo_intake_id: 'pi-ready', location_id: 'l1' }]);
    assert.deepEqual(errors, []);
});

test('erro de linha do servidor aparece embaixo da linha de foto', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { mode: 'page', url: '/admin/entrada?aba=manual',
        init: withDraft("window.previewPhotoError = 'Este aparelho da fila de foto já foi salvo.';") });
    await page.getByRole('button', { name: 'Conferir' }).click();
    const row = page.getByRole('listitem').filter({ hasText: draftPhotoLine.label });
    await row.getByText('Este aparelho da fila de foto já foi salvo.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirmar entrada' }).isDisabled(), true);
});
