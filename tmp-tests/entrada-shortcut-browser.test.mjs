import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, photoFixtures, photoServiceStubs, stubPlugin } from './entrada-fixtures.mjs';

// Atalho ?variacao= na página Entrada: a página carrega o produto, escolhe a aba e prende a variação.
const root = process.cwd().replaceAll('\\', '/');
const catalogStub = `export const catalogEntries = { preview: async () => ({ ok: true, hash: 'h', plan: [] }), commit: async () => ({}), get: async () => null };`;
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom';
import {CatalogEntryPage} from '${root}/pages/admin/entrada/CatalogEntryPage.tsx';
function Probe() {
  const loc = useLocation(); const navigate = useNavigate();
  window.__search = loc.search; window.__navigate = navigate;
  return null;
}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.__url]}><Probe /><CatalogEntryPage /></MemoryRouter>);`;

let script;
async function setup(t, url, { hold = false } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(photoServiceStubs), {
                name: 'entry', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0shortcut-entry.tsx';
                    if (/\/catalogEntries(?:\.ts)?$/.test(id)) return '\0catalog-entries-stub';
                },
                load(id) { if (id === '\0shortcut-entry.tsx') return entry; if (id === '\0catalog-entries-stub') return catalogStub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'ShortcutTest' } },
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
    await page.addInitScript(({ url, fixtures, hold }) => {
        window.__url = url;
        window.fixtures = fixtures;
        if (hold) {
            // Segura o produto até o teste liberar: o stub devolve a promessa (async adota o valor).
            const products = fixtures.products;
            let release;
            const gate = new Promise(r => { release = r; });
            window.release = () => release();
            window.fixtures.products = new Proxy({}, { get: (_, id) => gate.then(() => products[id] || null) });
        }
    }, { url, fixtures: { ...defaultFixtures, ...photoFixtures }, hold });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const text = page => page.locator('body').innerText();
const tab = (page, name) => page.getByRole('tab', { name });
const selected = async (page, name) => (await tab(page, name).getAttribute('aria-selected')) === 'true';
const modelBox = page => page.getByRole('combobox', { name: 'Modelo' });
const draftLines = page => page.evaluate(() => JSON.parse(localStorage.getItem('mdv-entrada-rascunho-v1') || '{"lines":[]}').lines);
const reader = page => page.getByLabel('Leitura de IMEI');

test('?variacao= de celular abre Bipar com o card; bipar sai como atalho com product_id', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, '/admin/entrada?variacao=p1');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await selected(page, 'Bipar'), true);
    assert.match(await text(page), /Redmi 15/);
    assert.match(await text(page), /RED15-8-256-VD/);
    assert.equal(await modelBox(page).count(), 0);
    assert.equal(await page.getByLabel('Informar preços desta configuração').count(), 0, 'variação fixa mantém os preços dela');
    await page.getByLabel('Custo').fill('900');
    assert.equal(await page.getByLabel('Local').inputValue(), 'l2');
    await page.getByRole('button', { name: 'Começar a bipar' }).click();
    await reader(page).fill('863715061138763');
    await reader(page).press('Enter');
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
    const lines = await draftLines(page);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].source, 'atalho');
    assert.equal(lines[0].label, 'Redmi 15 · RED15-8-256-VD · IMEI …8763');
    assert.deepEqual(lines[0].item, {
        source: 'atalho', product_id: 'p1',
        identity: { imei1: '863715061138763', imei2: null, serial: null },
        quantity: 1, cost_cents: 90000, location_id: 'l2', prices: null,
    });
    assert.deepEqual(errors, []);
});

test('?variacao= mostra "Carregando variação…" enquanto carrega', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=p1', { hold: true });
    await page.getByText('Carregando variação…').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Trocar' }).count(), 0);
    assert.equal(await modelBox(page).count(), 0, 'não mostra os campos normais enquanto carrega');
    await page.evaluate(() => window.release());
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await page.getByText('Carregando variação…').count(), 0);
});

test('?variacao= de celular antigo sem memória/cor prende pelo product_id', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, '/admin/entrada?variacao=p3');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await selected(page, 'Bipar'), true);
    assert.doesNotMatch(await text(page), /não tem memória\/cor/);
    await page.getByLabel('Custo').fill('500');
    await page.getByRole('button', { name: 'Começar a bipar' }).click();
    await reader(page).fill('863715061138763');
    await reader(page).press('Enter');
    await page.getByText('1 aparelho lido', { exact: true }).waitFor();
    const [line] = await draftLines(page);
    assert.equal(line.item.product_id, 'p3');
    assert.equal(line.item.source, 'atalho');
    assert.equal(line.label, 'Redmi Antigo · RED-OLD · IMEI …8763');
    assert.deepEqual(errors, []);
});

test('Review 5: ?variacao= de acessório abre Manual com o card; quantidade 5 sai como atalho', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t, '/admin/entrada?variacao=p4');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await selected(page, 'Manual'), true);
    const body = await text(page);
    assert.match(body, /Capa Silicone/);
    assert.match(body, /CAPA-SIL/);
    assert.doesNotMatch(body, /Use a aba Manual/);
    assert.equal(await modelBox(page).count(), 0);
    assert.equal(await page.getByLabel('RAM').count(), 0);
    assert.equal(await page.getByLabel('Condição').count(), 0);
    assert.equal(await page.getByLabel('Cor').count(), 0);
    assert.equal(await page.getByText('IMEI 1', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Informar preços desta configuração').count(), 0);
    await page.getByLabel('Quantidade').fill('5');
    await page.getByLabel('Custo').fill('10');
    await page.getByLabel('Observação').fill('caixa avariada');
    await page.getByRole('button', { name: 'Adicionar à lista' }).click();
    await page.getByText('Capa Silicone · CAPA-SIL · 5 un.').waitFor();
    const [line] = await draftLines(page);
    assert.equal(line.source, 'atalho');
    assert.deepEqual(line.item, {
        source: 'atalho', product_id: 'p4', condition_note: 'caixa avariada', battery_health: null,
        identity: { imei1: null, imei2: null, serial: null },
        quantity: 5, cost_cents: 1000, location_id: 'l2', prices: null,
    });
    assert.deepEqual(errors, []);
});

test('?variacao= de produto controlado por unidade (não celular) pede serial na Manual', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=p7');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await selected(page, 'Manual'), true);
    assert.equal(await page.getByLabel('Quantidade').count(), 0);
    assert.equal(await page.getByText('IMEI 1', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Saúde da bateria (%)').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Adicionar à lista' }).isDisabled(), true, 'unidade sem serial não entra');
    await page.getByLabel('Serial').fill('XYZ789');
    await page.getByRole('button', { name: 'Adicionar à lista' }).click();
    const [line] = await draftLines(page);
    assert.equal(line.item.product_id, 'p7');
    assert.equal(line.item.quantity, 1);
    assert.deepEqual(line.item.identity, { imei1: null, imei2: null, serial: 'XYZ789' });
    assert.equal(line.label, 'Fone Bluetooth · FONE-BT · Serial …Z789');
});

test('?aba=manual&variacao=<celular> respeita a Manual e pede IMEI e bateria', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?aba=manual&variacao=p1');
    await page.getByRole('button', { name: 'Trocar' }).waitFor();
    assert.equal(await selected(page, 'Manual'), true);
    assert.equal(await modelBox(page).count(), 0);
    assert.equal(await page.getByLabel('Quantidade').count(), 0);
    await page.locator('#manual-imei1').fill('863715061138763');
    await page.getByLabel('Saúde da bateria (%)').fill('91');
    await page.getByLabel('Custo').fill('900');
    await page.getByRole('button', { name: 'Adicionar à lista' }).click();
    await page.getByText('Redmi 15 · RED15-8-256-VD · IMEI …8763').waitFor();
    const [line] = await draftLines(page);
    assert.deepEqual(line.item, {
        source: 'atalho', product_id: 'p1', condition_note: null, battery_health: 91,
        identity: { imei1: '863715061138763', imei2: null, serial: null },
        quantity: 1, cost_cents: 90000, location_id: 'l2', prices: null,
    });
});

test('?aba=bipar&variacao=<acessório> avisa para usar a Manual', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?aba=bipar&variacao=p4');
    await page.getByText('Esta variação não é celular. Use a aba Manual.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Começar a bipar' }).count(), 0);
});

test('?variacao=<pai> mostra a mensagem do pai e não prende nada', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=p6');
    await page.getByText('Este é o produto pai da família. Escolha a variação (cor/memória).').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Trocar' }).count(), 0);
    assert.equal(await selected(page, 'Manual'), true);
    await modelBox(page).waitFor();
});

test('?variacao=<inexistente> mostra "Produto não encontrado." e não prende nada', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=zzz');
    await page.getByText('Produto não encontrado.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Trocar' }).count(), 0);
    await modelBox(page).waitFor();
});

test('?variacao= com categoria não identificada avisa e não prende nada', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=p5');
    await page.getByText('Não foi possível identificar a categoria do modelo.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Trocar' }).count(), 0);
});

test('Trocar tira variacao da URL e volta os campos normais', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?variacao=p1');
    await page.getByRole('button', { name: 'Trocar' }).click();
    await modelBox(page).waitFor();
    const search = await page.evaluate(() => window.__search);
    assert.equal(new URLSearchParams(search).get('variacao'), null);
    assert.equal(await selected(page, 'Bipar'), true, 'continua na aba em que estava');
    assert.equal(await page.getByRole('button', { name: 'Trocar' }).count(), 0);

    const manual = await setup(t, '/admin/entrada?variacao=p4');
    await manual.page.getByRole('button', { name: 'Trocar' }).click();
    await modelBox(manual.page).waitFor();
    assert.equal(new URLSearchParams(await manual.page.evaluate(() => window.__search)).get('variacao'), null);
    assert.equal(await selected(manual.page, 'Manual'), true);
});

test('?aba=manual&modelo= continua preenchendo o modelo e acompanha a troca do parâmetro', { timeout: 120000 }, async t => {
    const { page } = await setup(t, '/admin/entrada?aba=manual&modelo=m1');
    await page.getByText('IMEI 1', { exact: true }).waitFor();
    assert.equal(await modelBox(page).inputValue(), 'Redmi 15');
    await page.evaluate(() => window.__navigate('/admin/entrada?aba=manual&modelo=m3'));
    await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.value === 'Poco X8');
});
