import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { defaultFixtures, stubPlugin } from './entrada-fixtures.mjs';

const root = process.cwd().replaceAll('\\', '/');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {SpreadsheetEntryTab} from '${root}/components/entrada/SpreadsheetEntryTab.tsx';
import {addLines, emptyState} from '${root}/components/entrada/entryList.js';
function App() {
  const [state, setState] = React.useState(() => emptyState());
  return <SpreadsheetEntryTab existingState={state} busy={!!window.__busy}
    onAddLines={lines => { window.added ||= []; window.added.push(...lines); setState(s => addLines(s, lines)); }} />;
}
createRoot(document.getElementById('root')).render(<App />);`;
const excelStub = `export async function readExcelObjects() {
  if (window.excelThrow) throw new Error('boom');
  return window.excelRows;
}
export async function writeExcelRows(fileName, rows, headers) { window.writtenTemplate = { fileName, rows, headers }; }
export async function writeExcelTemplate() {}`;

let script;
async function setup(t, { busy } = {}) {
    if (!script) {
        const bundled = await build({
            configFile: false, logLevel: 'error',
            define: { 'process.env.NODE_ENV': '"production"' },
            plugins: [react(), stubPlugin(), {
                name: 'entry', enforce: 'pre',
                resolveId(id) {
                    if (id.endsWith('virtual:entry')) return '\0sheet-entry.tsx';
                    if (/\/utils\/excel(?:\.ts)?$/.test(id)) return '\0excel-stub.js';
                },
                load(id) { if (id === '\0sheet-entry.tsx') return entry; if (id === '\0excel-stub.js') return excelStub; },
            }],
            build: { write: false, minify: false, lib: { entry: 'virtual:entry', formats: ['iife'], name: 'SheetTest' } },
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
    await page.addInitScript(({ fixtures, busy }) => { window.fixtures = fixtures; window.__busy = busy; }, { fixtures: defaultFixtures, busy });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    return { page, errors };
}

const base = { Modelo: 'Redmi 15', RAM: '8GB', Armazenamento: '256GB', 'Condição': 'Novo', Cor: 'Verde', Custo: '800,00' };
const rows3 = () => [
    { ...base, 'IMEI 1': '863715061138763' },
    { ...base, 'IMEI 1': '863715061138771' },
    { ...base, Serial: 'SN-0001' },
    { ...base, 'Condição': 'ok', Serial: 'SN-0002' },
];
const file = { name: 'entrada.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') };
async function upload(page, rows, opts = {}) {
    await page.evaluate(({ rows, thr }) => { window.excelRows = rows; window.excelThrow = thr; }, { rows, thr: !!opts.throws });
    await page.locator('input[type=file]').setInputFiles(file);
}

test('baixar modelo chama writeExcelRows com exemplos e cabeçalhos', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await page.getByRole('button', { name: 'Baixar modelo da planilha' }).click();
    await page.waitForFunction(() => window.writtenTemplate);
    const w = await page.evaluate(() => window.writtenTemplate);
    assert.equal(w.fileName, 'modelo_entrada.xlsx');
    assert.equal(w.headers.length, 18);
    assert.equal(w.headers[0], 'Modelo');
    assert.equal(w.rows.length, 2);
    assert.deepEqual(errors, []);
});

test('3 linhas válidas e 1 problema: resumo, tabela e adicionar', { timeout: 120000 }, async t => {
    const { page, errors } = await setup(t);
    await upload(page, rows3());
    await page.getByText('3 linhas prontas', { exact: true }).waitFor();
    const body = await page.locator('body').innerText();
    assert.match(body, /Condição inválida: ok/);
    assert.match(body, /5/); // linha 5 da planilha
    await page.getByRole('button', { name: 'Adicionar 3 linhas à lista' }).click();
    const added = await page.evaluate(() => window.added);
    assert.equal(added.length, 3);
    assert.ok(added.every(l => l.source === 'planilha'));
    await page.getByText('3 linhas prontas').waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: /Adicionar/ }).count(), 0);
    assert.deepEqual(errors, []);
});

test('fatal mostra a mensagem e nenhum botão de adicionar', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await upload(page, [{ Foo: 'bar' }]);
    await page.getByText('Esta planilha não é o modelo da Entrada. Baixe o modelo.').waitFor();
    assert.equal(await page.getByRole('button', { name: /Adicionar/ }).count(), 0);
});

test('arquivo só com cabeçalho: nenhuma linha encontrada', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await upload(page, []);
    await page.getByText('Nenhuma linha encontrada na planilha.').waitFor();
    assert.equal(await page.getByRole('button', { name: /Adicionar/ }).count(), 0);
});

test('erro de leitura mostra mensagem', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await upload(page, [], { throws: true });
    await page.getByText('Não foi possível ler a planilha. Use o modelo .xlsx da Entrada.').waitFor();
});

test('reenviar o mesmo arquivo: já estão na lista', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await upload(page, rows3());
    await page.getByRole('button', { name: 'Adicionar 3 linhas à lista' }).click();
    await page.getByText('3 linhas prontas').waitFor({ state: 'detached' });
    await upload(page, rows3());
    await page.getByText('0 linhas prontas', { exact: true }).waitFor();
    await page.getByText('3 já estão na lista').waitFor();
    assert.equal(await page.getByRole('button', { name: /Adicionar/ }).count(), 0);
    assert.equal((await page.evaluate(() => window.added)).length, 3);
});

test('singular: 1 já está na lista', { timeout: 120000 }, async t => {
    const { page } = await setup(t);
    await upload(page, rows3().slice(0, 1));
    await page.getByRole('button', { name: 'Adicionar 1 linha à lista' }).click();
    await page.getByText('1 linha pronta').waitFor({ state: 'detached' });
    await upload(page, rows3().slice(0, 2));
    await page.getByText('1 linha pronta', { exact: true }).waitFor();
    await page.getByText('1 já está na lista').waitFor();
});

test('busy desabilita o botão de adicionar', { timeout: 120000 }, async t => {
    const { page } = await setup(t, { busy: true });
    await upload(page, rows3());
    await page.getByText('3 linhas prontas', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Adicionar 3 linhas à lista' }).isDisabled(), true);
});
