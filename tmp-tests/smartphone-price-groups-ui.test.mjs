import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the real panel with local fixtures only. Never forward API requests.
const prices = { price_retail: 113200, price_reseller: 108200, price_wholesale: 103200 };
const group = { id: 'example', model_id: 'redmi15c', model_name: 'Redmi 15c', company_id: null,
  ram: '8GB', storage: '256GB', version: 'global', network: '4g', condition: 'new', revision: 'r1',
  confirmed: false, divergent: false, prices, cost_min: 93200, cost_max: 105000, cost_average_in_stock: 101600,
  products: ['A', 'L', 'V'].map((suffix, i) => ({ id: suffix, sku: `R15C8256${suffix}`, color: ['Azul', 'Laranja', 'Verde'][i], name: 'Redmi 15c',
    stock_quantity: i === 2 ? 0 : 1, price_cost: i ? 93200 : 98200, unit_costs: i ? [] : [98200, 105000], ...prices })) };
let saved;
let divergent = false;
const unitRows = [{ id: 'unit-one', product_id: 'A', imei_1: 'TEST-IMEI-ONE', imei_2: 'TEST-SECOND-ONE', status: 'available', cost_price: 98200 },
  { id: 'unit-two', product_id: 'A', imei_1: 'TEST-IMEI-TWO', status: 'available', cost_price: 105000 }];
const costWrites = [];
let failCostSave = false;
const out = mkdtempSync(join(tmpdir(), 'mdv-smartphone-price-ui-'));
await build({ configFile: 'vite.config.ts', root: process.cwd(), build: { outDir: out, emptyOutDir: true,
  rollupOptions: { input: 'tmp-tests/smartphone-price-groups-preview.html' } } });
const server = await preview({ configFile: false, root: out, build: { outDir: '.' }, preview: { host: '127.0.0.1', port: 5199 } });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes('/units?')) return route.fulfill({ json: unitRows });
    if (url.includes('/units/unit-')) {
      assert.equal(route.request().method(), 'PUT');
      const data = route.request().postDataJSON();
      costWrites.push(data);
      assert.deepEqual(Object.keys(data), ['cost_price'], 'unit edits must never submit sale prices, identifiers or status');
      if (failCostSave) return route.fulfill({ status: 500, json: { message: 'Falha simulada ao salvar compra' } });
      const unit = unitRows.find(u => url.includes('/units/' + u.id));
      unit.cost_price = data.cost_price;
      group.products[0].unit_costs = unitRows.map(u => u.cost_price);
      group.cost_average_in_stock = Math.round((unitRows.reduce((total, u) => total + u.cost_price, 0) + 93200) / 3);
      return route.fulfill({ json: unit });
    }
    if (url.includes('/models/') && url.includes('/smartphone-price-groups')) {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON();
        Object.assign(group, { prices: saved.prices, confirmed: true });
        group.products.forEach(p => Object.assign(p, saved.prices));
        return route.fulfill({ json: { ok: true, updated: 3 } });
      }
      return route.fulfill({ json: { enabled: true, unresolved: [], groups: [{ ...group, ...(divergent ? { prices: null, divergent: true } : {}) }] } });
    }
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
  await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/smartphone-price-groups-preview.html`);
  try { await page.getByText('R15C8256A · Azul', { exact: true }).waitFor(); }
  catch (error) { console.log(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1500) })); throw error; }
  assert.equal(await page.getByRole('textbox').count(), 3, 'cost must not have a bulk editor');
  assert.match(await page.locator('section').innerText(), /Custo médio em estoque: R\$\s*1\.016,00/);
  assert.equal(await page.locator('section strong').first().innerText(), '8GB · 256GB · global', 'historical financial network must not appear as a model characteristic');
  await page.getByRole('textbox').first().fill('1250,00');
  await page.getByRole('button', { name: 'Editar compra por IMEI', exact: true }).first().click();
  await page.getByText('TEST-IMEI-ONE', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Pesquisar aparelho por IMEI ou serial' }).fill('SECOND-ONE');
  assert.equal(await page.getByText('TEST-IMEI-TWO', { exact: true }).count(), 0, 'IMEI 2 must filter the correct unit');
  await page.getByRole('button', { name: 'Editar compra', exact: true }).click();
  const purchaseButton = page.getByRole('button', { name: 'Cancelar', exact: true });
  assert.equal(await purchaseButton.isVisible(), true);
  const purchaseField = page.getByRole('textbox', { name: 'Valor de compra do aparelho' });
  const costCell = purchaseField.locator('xpath=ancestor::td');
  assert.equal(await costCell.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'purchase editor must fit its cost cell');
  await page.screenshot({ path: join(out, 'purchase-editor.png'), fullPage: true });
  await page.getByRole('textbox', { name: 'Valor de compra do aparelho' }).fill('1200,00');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(costWrites.length, 0, 'cancel must not persist costs');
  await page.getByRole('button', { name: 'Editar compra', exact: true }).click();
  await page.getByRole('textbox', { name: 'Valor de compra do aparelho' }).fill('1200,00');
  failCostSave = true;
  await page.getByRole('button', { name: 'Salvar compra', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada' }).waitFor();
  assert.equal(unitRows[0].cost_price, 98200, 'failed save must preserve cost');
  failCostSave = false;
  await page.getByRole('button', { name: 'Salvar compra', exact: true }).click();
  await page.getByText(/Custo médio em estoque: R\$\s*1\.060,67/).waitFor();
  assert.equal(unitRows[0].cost_price, 120000);
  assert.equal(unitRows[1].cost_price, 105000, 'another IMEI must keep its own cost');
  assert.equal(saved, undefined, 'saving unit cost must not save the sale-price group');
  assert.deepEqual(group.products[0].price_retail, prices.price_retail);
  assert.match(await page.getByRole('textbox').first().inputValue(), /1\.250,00|1250,00/);
  await page.getByRole('button', { name: 'Fechar aparelhos', exact: true }).click();
  await page.getByText('Só divergências', { exact: false }).click();
  await page.getByText('Nenhum grupo divergente.').waitFor();
  await page.getByText('Só divergências', { exact: false }).click();
  await page.getByRole('textbox').first().fill('1200,00');
  await page.getByRole('button', { name: 'Salvar preço para todas as cores (3)' }).click();
  await page.getByText('Preço do grupo definido', { exact: true }).waitFor();
  assert.equal(saved.prices.price_retail, 120000);
  assert.equal(saved.prices.price_cost, undefined);
  assert.equal(saved.product_id, 'A');
  assert.equal(saved.revision, 'r1');
  await page.screenshot({ path: join(out, 'desktop.png'), fullPage: true });
  divergent = true;
  await page.getByRole('button', { name: 'Recarregar' }).click();
  await page.getByText('Nenhum valor foi selecionado automaticamente.', { exact: false }).waitFor();
  assert.deepEqual(await page.getByRole('textbox').evaluateAll(inputs => inputs.map(i => i.value)), ['', '', '']);
  saved = null;
  await page.getByRole('button', { name: 'Salvar preço para todas as cores (3)' }).click();
  assert.equal(saved, null, 'empty divergence must not send prices');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'table should scroll inside the panel');
  assert.deepEqual(errors, []);
  console.log(`Smartphone price panel browser checks passed. Screenshots: ${out}`);
} finally { await browser?.close(); await server.close(); }
