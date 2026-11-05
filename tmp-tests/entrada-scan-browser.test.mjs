import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, stubPlugin } from './entrada-fixtures.mjs';

const root = process.cwd().replaceAll('\\', '/');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {ScanEntryTab} from '${root}/components/entrada/ScanEntryTab.tsx';
import {addLines, emptyState} from '${root}/components/entrada/entryList.js';
function App() {
  const [state, setState] = React.useState(() => window.__state || emptyState());
  window.removeAll = () => setState(emptyState());
  window.setBusy = v => { window.__busy = v; setBump(n => n + 1); };
  const [, setBump] = React.useState(0);
  return <ScanEntryTab existingState={state} prefill={window.__prefill} busy={!!window.__busy}
    onAddLines={lines => { window.added ||= []; window.added.push(...lines); setState(s => addLines(s, lines)); }} />;
}
createRoot(document.getElementById('root')).render(<App />);`;
const scanStub = `import React from 'react';
export const BarcodeScanButton = ({ onScan, allowPair }) => <>
  <button type="button" onClick={() => onScan(['863715061138763', '863715061138771'])}>simular par</button>
  <button type="button" onClick={() => onScan(['863715061138771'])}>simular um</button>
</>;`;

let script;
async function setup(t, { prefill, busy, state } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(), {
                name: 'entry', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0scan-entry.tsx';
                    if (/\/BarcodeScanButton(?:\.tsx)?$/.test(id)) return '\0scan-button-stub.jsx';
                },
                load(id) { if (id === '\0scan-entry.tsx') return entry; if (id === '\0scan-button-stub.jsx') return scanStub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'ScanTest' } },
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
    await page.addInitScript(({ fixtures, prefill, busy, state }) => { window.fixtures = fixtures; window.__prefill = prefill; window.__busy = busy; window.__state = state; }, { fixtures: defaultFixtures, prefill, busy, state });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const text = page => page.locator('body').innerText();
const start = page => page.getByRole('button', { name: 'Começar a bipar' });
const reader = page => page.getByLabel('Leitura de IMEI');

async function lock(page) {
    const box = page.getByRole('combobox', { name: 'Modelo' });
    await box.click();
    await box.fill('Redm');
    await page.getByRole('listbox').getByRole('button', { name: 'Redmi 15' }).click();
    await page.getByLabel('RAM').selectOption('8GB');
    await page.getByLabel('Armazenamento').selectOption('256GB');
    await page.getByRole('button', { name: 'Verde' }).click();
    await page.getByLabel('Custo').fill('1500,50');
    await page.getByLabel('Local').selectOption('l1');
}
async function begin(page) { await lock(page); await start(page).click(); await reader(page).waitFor(); }
async function bip(page, value) { await reader(page).fill(value); await reader(page).press('Enter'); }

test('Começar a bipar só aparece com tudo preenchido', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    const box = page.getByRole('combobox', { name: 'Modelo' });
    await box.click(); await box.fill('Redm');
    await page.getByRole('listbox').getByRole('button', { name: 'Redmi 15' }).click();
    await page.getByLabel('RAM').waitFor();
    assert.equal(await start(page).count(), 0);
    await page.getByLabel('RAM').selectOption('8GB');
    await page.getByLabel('Armazenamento').selectOption('256GB');
    await page.getByRole('button', { name: 'Verde' }).click();
    await page.getByLabel('Custo').fill('1500,50');
    await page.getByLabel('Local').selectOption('');
    assert.equal(await start(page).count(), 0);
    await page.getByLabel('Local').selectOption('l1');
    await start(page).waitFor();
    assert.deepEqual(errors, []);
});

test('digitar IMEI + Enter adiciona 1 linha bipar, limpa e mantém o foco', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await begin(page);
    await bip(page, '863715061138763');
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
    const lines = await page.evaluate(() => window.added);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].source, 'bipar');
    assert.deepEqual(lines[0].item, {
        source: 'bipar', model_id: 'm1', category_id: 'c1', name: 'Redmi 15',
        configuration: { ram: '8GB', storage: '256GB', version: 'Global', network: '', condition: 'new' },
        color: 'Verde', condition_note: null,
        identity: { imei1: '863715061138763', imei2: null, serial: null },
        quantity: 1, cost_cents: 150050, location_id: 'l1', prices: null,
    });
    assert.equal(await reader(page).inputValue(), '');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Leitura de IMEI');
    assert.deepEqual(errors, []);
});

test('par pela câmera adiciona 1 linha com imei1 e imei2', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    await page.getByRole('button', { name: 'simular par' }).click();
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
    const lines = await page.evaluate(() => window.added);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].item.identity, { imei1: '863715061138763', imei2: '863715061138771', serial: null });
});

test('repetir leitura não duplica e avisa (mesmo leitor repetindo)', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    // duas leituras idênticas antes de o React re-renderizar
    await page.evaluate(() => {
        const el = document.querySelector('[aria-label="Leitura de IMEI"]');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        for (let i = 0; i < 2; i++) {
            set.call(el, '863715061138763'); el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
    });
    await page.getByText('IMEI já está na lista').waitFor();
    assert.equal((await page.evaluate(() => window.added)).length, 1);
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
});

test('IMEI que já está na lista da página não é adicionado', { timeout: 120000 }, async t => {
    const state = { lines: [{ key: 'x', source: 'manual', label: 'x', item: { source: 'manual', identity: { imei1: '863715061138771', imei2: null, serial: null } } }], plan: null, hash: null, previewedSignature: null };
    const { page } = await setup(t, { state });
    await begin(page);
    await bip(page, '863715061138771');
    await page.getByText('IMEI já está na lista').waitFor();
    assert.equal(await page.evaluate(() => window.added || []).then(a => a.length), 0);
    await page.getByRole('button', { name: 'simular um' }).click();
    assert.equal((await page.evaluate(() => window.added || [])).length, 0);
});

test('IMEI inválido não adiciona', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    await bip(page, '863715061138764');
    await page.getByText('IMEI inválido').waitFor();
    assert.equal((await page.evaluate(() => window.added || [])).length, 0);
    assert.match(await text(page), /0 aparelhos lidos/);
});

test('?variacao= chega travado no produto, sem pedir modelo', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p1' } });
    await page.getByText('Redmi 15 · Verde · 8GB/256GB').waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Modelo' }).count(), 0);
    assert.equal(await start(page).count(), 0);
    await page.getByLabel('Custo').fill('900');
    assert.equal(await page.getByLabel('Local').inputValue(), 'l2');
    await start(page).click();
    await bip(page, '863715061138763');
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.equal(item.model_id, 'm1');
    assert.deepEqual(item.configuration, { ram: '8GB', storage: '256GB', version: 'Global', network: '', condition: 'new' });
    assert.equal(item.color, 'Verde');
    assert.equal(item.cost_cents, 90000);
    assert.equal(item.location_id, 'l2');
});

test('?variacao= usa versão e condição do produto', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p2' } });
    await page.getByText('Poco X8 · Preto · 12GB/512GB').waitFor();
    await page.getByLabel('Custo').fill('900');
    await start(page).click();
    await bip(page, '863715061138763');
    const item = (await page.evaluate(() => window.added))[0].item;
    assert.deepEqual(item.configuration, { ram: '12GB', storage: '512GB', version: 'India', network: '', condition: 'seminovo' });
});

test('contador mostra 3 aparelhos lidos', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    await bip(page, '863715061138763');
    await page.getByRole('button', { name: 'simular um' }).click();
    await bip(page, '490154203237518');
    await page.getByText('3 aparelhos lidos', { exact: true }).waitFor();
});

test('busy desabilita a leitura', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p1' }, busy: true });
    await page.getByLabel('Custo').fill('900');
    assert.equal(await start(page).isDisabled(), true);
});

test('remover a linha libera reler o mesmo IMEI', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    await bip(page, '863715061138763');
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
    await page.evaluate(() => window.removeAll());
    await bip(page, '863715061138763');
    await page.getByText('2 aparelhos lidos', { exact: true }).waitFor();
    assert.equal((await page.evaluate(() => window.added)).length, 2);
});

test('depois de busy o campo de leitura volta ao foco', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    await page.evaluate(() => window.setBusy(true));
    await page.waitForFunction(() => document.querySelector('[aria-label="Leitura de IMEI"]').disabled);
    await page.evaluate(() => window.setBusy(false));
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Leitura de IMEI');
});

test('?variacao= sem memória/cor avisa e não trava', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p3' } });
    await page.getByText('Esta variação não tem memória/cor definidas. Use a aba Manual.').waitFor();
    assert.equal(await start(page).count(), 0);
});

test('?variacao= de produto que não é celular avisa', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p4' } });
    await page.getByText('Esta variação não é celular. Use a aba Manual.').waitFor();
    assert.equal(await start(page).count(), 0);
});

test('?variacao= com categoria não identificada não libera a leitura', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p5' } });
    await page.getByText('Não foi possível identificar a categoria do modelo.').waitFor();
    await page.getByLabel('Custo').count();
    assert.equal(await start(page).count(), 0);
});

test('I3: preços opcionais da configuração vão em todas as leituras', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await lock(page);
    const toggle = page.getByLabel('Informar preços desta configuração');
    assert.equal(await toggle.isChecked(), false);
    assert.equal(await page.getByLabel('Varejo').count(), 0);
    await toggle.check();
    assert.equal(await start(page).count(), 0, 'preço ligado e vazio não libera a leitura');
    await page.getByLabel('Varejo').fill('1999,90');
    await page.getByLabel('Revenda').fill('1899');
    assert.equal(await start(page).count(), 0);
    await page.getByLabel('Atacado').fill('1799,50');
    await start(page).click();
    await bip(page, '863715061138763');
    await page.getByRole('button', { name: 'simular um' }).click();
    await page.getByText('2 aparelhos lidos', { exact: true }).waitFor();
    const prices = { price_retail: 199990, price_reseller: 189900, price_wholesale: 179950 };
    assert.deepEqual((await page.evaluate(() => window.added)).map(l => l.item.prices), [prices, prices]);
    assert.deepEqual(errors, []);
});

test('I3: desligar os preços volta a mandar prices null', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await lock(page);
    await page.getByLabel('Informar preços desta configuração').check();
    await page.getByLabel('Varejo').fill('10');
    await page.getByLabel('Informar preços desta configuração').uncheck();
    await start(page).click();
    await bip(page, '863715061138763');
    assert.equal((await page.evaluate(() => window.added))[0].item.prices, null);
});

test('I3: ?variacao= também oferece os preços', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { prefill: { variation_id: 'p1' } });
    await page.getByText('Redmi 15 · Verde · 8GB/256GB').waitFor();
    await page.getByLabel('Informar preços desta configuração').check();
    await page.getByLabel('Varejo').fill('100');
    await page.getByLabel('Revenda').fill('90');
    await page.getByLabel('Atacado').fill('80');
    await page.getByLabel('Custo').fill('50');
    await start(page).click();
    await bip(page, '863715061138763');
    assert.deepEqual((await page.evaluate(() => window.added))[0].item.prices, { price_retail: 10000, price_reseller: 9000, price_wholesale: 8000 });
});

test('M1: ocupado mostra "Aguarde…" ao lado do leitor', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await begin(page);
    assert.equal(await page.getByText('Aguarde…').count(), 0);
    await page.evaluate(() => window.setBusy(true));
    await page.getByText('Aguarde…').waitFor();
    assert.equal(await reader(page).isDisabled(), true);
    await page.evaluate(() => window.setBusy(false));
    await page.waitForFunction(() => !document.body.innerText.includes('Aguarde…'));
});
