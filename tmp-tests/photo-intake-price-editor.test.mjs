import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = mkdtempSync(join(tmpdir(), 'mdv-intake-prices-'));
await build({ configFile: 'vite.config.ts', root: process.cwd(), build: { outDir: output, emptyOutDir: true,
  rollupOptions: { input: 'tmp-tests/smartphone-price-groups-preview.html' } } });
const server = await preview({ configFile: false, root: output, build: { outDir: '.' }, preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let prices = null;
let saved;
let references = 0;
let failAverage = false;
const group = { id: 'example', model_id: 'redmi15c', ram: '8GB', storage: '256GB', version: 'Global', condition: 'new', revision: 'r1', divergent: true, prices: null, cost_min: 98400, cost_max: 105000, cost_average_in_stock: 101600, last_purchase_cost: 102000, products: [{ id: 'A', sku: 'TEST-A', color: 'Azul', price_cost: 98400, stock_quantity: 1 }] };
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  await page.route('**/*', async route => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes('/smartphone-price-reference')) { references++; return route.fulfill({ json: { controlled: true, established: true, divergent: !prices, group_id: 'example', prices } }); }
    if (url.includes('/models/') && url.includes('/smartphone-price-groups')) {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON(); prices = saved.prices;
        return route.fulfill({ json: { ok: true, updated: 1 } });
      }
      if (failAverage) return route.fulfill({ status: 503, json: { error: 'Falha simulada na consulta da média' } });
      return route.fulfill({ json: { enabled: true, groups: [{ ...group, prices, divergent: !prices }], unresolved: [] } });
    }
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
  await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/smartphone-price-groups-preview.html?photo-intake=1`);
  try { await page.getByText(/Preços divergentes\. Use Ajustar/).waitFor(); }
  catch (error) { console.log(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 2000), references })); throw error; }
  const purchase = page.getByRole('textbox', { name: 'Compra deste aparelho', exact: true });
  const average = page.getByRole('status', { name: 'Compra média em estoque', exact: true });
  await average.getByText(/R\$\s*1\.016,00/).waitFor();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Compra deste aparelho"]')?.value === '1.020,00');
  assert.equal(await purchase.inputValue(), '1.020,00', 'last registered purchase prefills the unit cost instead of the average');
  await purchase.fill('975,00'); await purchase.blur();
  await page.getByRole('button', { name: 'Ajustar preços de venda', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Configuração do aparelho' }).waitFor();
  assert.equal(await dialog.getByRole('combobox', { name: 'Configuração do aparelho' }).inputValue(), 'example');
  for (const [index, value] of ['1290,00', '1240,00', '1190,00'].entries()) await dialog.getByRole('textbox').nth(index).fill(value);
  const savedResponse = page.waitForResponse(response => response.request().method() === 'PUT' && decodeURIComponent(response.url()).includes('/smartphone-price-groups/'));
  await dialog.getByRole('button', { name: /Salvar preço para todas as cores/ }).click();
  await savedResponse;
  await dialog.getByRole('button', { name: 'Fechar preços', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.getAttribute('aria-label') === 'Varejo' && input.value === '1.290,00'));
  assert.equal(await purchase.inputValue(), '975,00', 'sale price refresh must preserve the edited purchase cost');
  await average.getByText(/R\$\s*1\.016,00/).waitFor();
  assert.ok(references >= 2);
  assert.deepEqual(saved.prices, { price_retail: 129000, price_reseller: 124000, price_wholesale: 119000 });
  assert.equal(saved.prices.price_cost, undefined, 'sale editor must not submit purchase cost');
  assert.equal(await page.getByText(/Preços divergentes\. Use Ajustar/).count(), 0);
  await page.getByRole('button', { name: 'Confirmar preços', exact: true }).click();
  await page.waitForFunction(() => window.__confirmed);
  assert.deepEqual(await page.evaluate(() => window.__confirmed), { price_cost: 97500, price_retail: 129000, price_reseller: 124000, price_wholesale: 119000 });
  failAverage = true;
  await page.getByRole('button', { name: 'Atualizar valores', exact: true }).click();
  await average.getByText('Consulta indisponível', { exact: true }).first().waitFor();
  assert.equal(await average.getByText(/R\$\s*1\.016,00/).count(), 0, 'failed read cannot display a stale average');
  failAverage = false; group.cost_average_in_stock = null;
  await page.getByRole('button', { name: 'Atualizar valores', exact: true }).click();
  await average.getByText('Sem custo de compra informado em estoque', { exact: true }).waitFor();
  assert.equal(await purchase.inputValue(), '975,00');
  group.cost_average_in_stock = 101600;
  await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/smartphone-price-groups-preview.html?photo-intake=1&confirmed=1`);
  await page.getByRole('status', { name: 'Compra média em estoque', exact: true }).getByText(/R\$\s*1\.016,00/).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Compra deste aparelho', exact: true }).inputValue(), '984,00', 'a confirmed purchase must not be replaced by the latest acquisition');
  console.log('Photo intake reuses model price editor, refreshes sale values and preserves individual purchase cost.');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
