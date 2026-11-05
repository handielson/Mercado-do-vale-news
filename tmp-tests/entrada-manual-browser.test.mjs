import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, stubPlugin } from './entrada-fixtures.mjs';

const root = process.cwd().replaceAll('\\', '/');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {ManualEntryTab} from '${root}/components/entrada/ManualEntryTab.tsx';
function App() { const [, force] = React.useState(0); window.rerender = () => force(n => n + 1);
  return <ManualEntryTab prefill={window.__prefill} busy={!!window.__busy} onAddLines={lines => { window.added ||= []; window.added.push(...lines); }} />; }
createRoot(document.getElementById('root')).render(<App />);`;

let script;
async function setup(t, { prefill, busy } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(), {
                name: 'entry', enforce: 'pre',
                resolveId(id) { if (id.endsWith('virtual:entry')) return '\0manual-entry.tsx'; },
                load(id) { if (id === '\0manual-entry.tsx') return entry; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'ManualTest' } },
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
    await page.addInitScript(({ fixtures, prefill, busy }) => { window.fixtures = fixtures; window.__prefill = prefill; window.__busy = busy; }, { fixtures: defaultFixtures, prefill, busy });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const text = page => page.locator('body').innerText();
async function pickModel(page, name) {
    const box = page.getByRole('combobox', { name: 'Modelo' });
    await box.click();
    await box.fill(name.slice(0, 4));
    await page.getByRole('listbox').getByRole('button', { name }).click();
}
const add = page => page.getByRole('button', { name: 'Adicionar à lista' });

test('sem modelo o botão fica desabilitado', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await add(page).waitFor();
    assert.equal(await add(page).isDisabled(), true);
    assert.deepEqual(errors, []);
});

test('celular: campos, cores com foto e linha adicionada', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await pickModel(page, 'Redmi 15');
    for (const label of ['RAM', 'Armazenamento', 'Versão', 'Condição', 'IMEI 1', 'IMEI 2', 'Serial', 'Custo', 'Local']) {
        await page.getByText(label, { exact: true }).first().waitFor();
    }
    assert.equal(await page.getByLabel('Versão').inputValue(), 'Global');
    assert.deepEqual(await page.getByLabel('Condição').locator('option').allInnerTexts(), ['Novo', 'Seminovo', 'Usado', 'Caixa aberta']);
    await page.getByRole('button', { name: 'Verde' }).waitFor();
    await page.getByRole('button', { name: 'Preto' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Rosa' }).count(), 0);
    assert.doesNotMatch(await text(page), /Quantidade/);
    await page.getByLabel('RAM').selectOption('8GB');
    await page.getByLabel('Armazenamento').selectOption('256GB');
    await page.getByRole('button', { name: 'Verde' }).click();
    await page.locator('#manual-imei1').fill('863715061138763');
    await page.getByLabel('Custo').fill('1500,50');
    await page.getByLabel('Local').selectOption('l1');
    assert.equal(await add(page).isEnabled(), true);
    await add(page).click();
    const lines = await page.evaluate(() => window.added);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].source, 'manual');
    assert.deepEqual(lines[0].item, {
        source: 'manual', model_id: 'm1', category_id: 'c1', name: 'Redmi 15',
        configuration: { ram: '8GB', storage: '256GB', version: 'Global', network: '', condition: 'new' },
        color: 'Verde', condition_note: null,
        identity: { imei1: '863715061138763', imei2: null, serial: null },
        quantity: 1, cost_cents: 150050, location_id: 'l1', prices: null,
    });
    assert.deepEqual(errors, []);
});

test('Seminovo mostra Observação do seminovo em condition_note', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Redmi 15');
    assert.equal(await page.getByLabel('Observação do seminovo').count(), 0);
    await page.getByLabel('Condição').selectOption('seminovo');
    await page.getByLabel('Observação do seminovo').fill('Risco leve na tela');
    await page.getByRole('button', { name: 'Verde' }).click();
    await add(page).click();
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.equal(item.condition_note, 'Risco leve na tela');
    assert.equal(item.configuration.condition, 'seminovo');
});

test('acessório mostra Quantidade no lugar de IMEI', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Capa Silicone');
    await page.getByLabel('Quantidade').waitFor();
    assert.doesNotMatch(await text(page), /IMEI 1/);
    await page.getByLabel('Quantidade').fill('5');
    await add(page).click();
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.equal(item.quantity, 5);
    assert.deepEqual(item.identity, { imei1: null, imei2: null, serial: null });
});

test('preços só com a opção marcada e vão em prices', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Redmi 15');
    assert.doesNotMatch(await text(page), /Varejo/);
    await page.getByLabel('Informar preços desta configuração').check();
    for (const l of ['Varejo', 'Revenda', 'Atacado']) await page.getByText(l, { exact: true }).waitFor();
    await page.getByLabel('Varejo').fill('2000');
    await page.getByLabel('Revenda').fill('1800');
    await page.getByLabel('Atacado').fill('1700');
    await page.getByRole('button', { name: 'Verde' }).click();
    await add(page).click();
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.deepEqual(item.prices, { price_retail: 200000, price_reseller: 180000, price_wholesale: 170000 });
});

test('?modelo= seleciona o modelo; busy desabilita Adicionar', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { model_id: 'm1' }, busy: true });
    await page.getByText('IMEI 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Verde' }).click();
    assert.equal(await add(page).isDisabled(), true);
});

test('trocar de modelo zera preços, identidade e observação', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Redmi 15');
    await page.getByLabel('Informar preços desta configuração').check();
    await page.getByLabel('Varejo').fill('2000');
    await page.locator('#manual-imei1').fill('863715061138763');
    await page.getByLabel('Serial').fill('SER123');
    await page.getByLabel('Condição').selectOption('seminovo');
    await page.getByLabel('Observação do seminovo').fill('Risco');
    await page.getByLabel('Custo').fill('900');
    await pickModel(page, 'Poco X8');
    await page.getByText('IMEI 1', { exact: true }).waitFor();
    await page.getByLabel('Condição').selectOption('seminovo');
    assert.equal(await page.getByLabel('Observação do seminovo').inputValue(), '');
    assert.equal(await page.getByLabel('Informar preços desta configuração').isChecked(), false);
    await add(page).click();
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.equal(item.model_id, 'm3');
    assert.equal(item.prices, null);
    assert.deepEqual(item.identity, { imei1: null, imei2: null, serial: null });
    assert.equal(item.condition_note, null);
    assert.equal(item.cost_cents, 90000);
});

test('sem local o botão fica desabilitado com dica; custo zerado avisa', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Redmi 15');
    assert.match(await text(page), /Custo zerado/);
    await page.getByLabel('Local').selectOption('');
    assert.match(await text(page), /Escolha o local de estoque\./);
    assert.equal(await add(page).isDisabled(), true);
    await page.getByLabel('Local').selectOption('l1');
    assert.equal(await add(page).isEnabled(), true);
});

test('falha ao identificar a categoria bloqueia e avisa', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Sem Categoria Boa');
    await page.getByText('Não foi possível identificar a categoria do modelo.').waitFor();
    assert.doesNotMatch(await text(page), /IMEI 1|Quantidade/);
    assert.equal(await add(page).isDisabled(), true);
});

test('após adicionar celular o foco volta ao IMEI 1', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await pickModel(page, 'Redmi 15');
    await page.locator('#manual-imei1').fill('863715061138763');
    await add(page).click();
    await page.waitForFunction(() => document.activeElement?.id === 'manual-imei1');
});
