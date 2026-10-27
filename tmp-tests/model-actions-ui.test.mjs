import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'mdv-model-actions-'));
await build({ configFile: 'vite.config.ts', build: { outDir: out, emptyOutDir: true,
    rollupOptions: { input: 'tmp-tests/model-actions-preview.html' } } });
const server = await preview({ configFile: false, root: out, build: { outDir: '.' }, preview: { host: '127.0.0.1', port: 5201 } });
let browser;
try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/model-actions-preview.html`);
    const trigger = page.getByRole('button', { name: 'Mais ações de Poco X8 5G', exact: true });
    const menu = page.getByRole('menu');
    for (const [label, expected] of [['Produto pai, fotos e variações', 'Produto pai'], ['Trazer medidas do Bling', 'Trazer medidas'],
        ['Enviar medidas para o Bling', 'Enviar medidas'], ['Re-sincronizar SKUs do Bling', 'SKUs'], ['Excluir modelo', 'Excluir']]) {
        await trigger.click();
        await page.getByRole('menuitem', { name: label, exact: true }).click();
        assert.equal(await page.getByRole('status').innerText(), expected);
        assert.equal(await menu.count(), 0);
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    }
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.getByRole('menuitem').first().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('menuitem').last().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await menu.count(), 0);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await page.getByRole('checkbox').check();
    await trigger.click();
    assert.equal(await page.getByRole('menuitem', { name: /Bling/ }).evaluateAll(items => items.every(el => el.disabled)), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.getByRole('menuitem', { name: 'Excluir modelo', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Fora da tabela' }).click();
    assert.equal(await menu.count(), 0);
    await page.getByRole('checkbox').uncheck();
    await trigger.click();
    const nextTrigger = page.getByRole('button', { name: 'Mais ações de Redmi 15C', exact: true });
    await nextTrigger.focus();
    await page.keyboard.press('Enter');
    assert.equal(await menu.count(), 1, 'only one row menu may stay open');
    await page.keyboard.press('Escape');
    for (const width of [1200, 390]) {
        await page.setViewportSize({ width, height: 560 });
        await page.getByRole('button', { name: 'Mais ações de Último modelo', exact: true }).click();
        const box = await menu.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 561, 'menu must fit the viewport near the bottom and on mobile');
        await page.screenshot({ path: join(out, `menu-${width}.png`) });
        await page.keyboard.press('Escape');
    }
    await trigger.click();
    await page.keyboard.press('Tab');
    // Tabbing through the menu eventually leaves it and dismisses it.
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    assert.equal(await menu.count(), 0);
    assert.deepEqual(errors, []);
    await page.goto(`${server.resolvedUrls.local[0]}tmp-tests/model-actions-preview.html?pagination`);
    await page.getByText('Página 1 de 62', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Preços por configuração · todas as cores', exact: true }).first().waitFor();
    assert.equal(await page.locator('tbody > tr').count(), 25);
    assert.equal(await page.evaluate(() => window.priceCalls.length), 25, 'Não consultar os 1550 modelos ao abrir a lista');
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await page.getByText('Página 2 de 62', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody > tr').count(), 25);
    await page.getByPlaceholder('Pesquisar por nome ou marca…').fill('Poco X8');
    await page.getByText('Página 1 de 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Preços por configuração · todas as cores', exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar variações e preços juntos', exact: true }).waitFor();
    assert.equal(await page.locator('tbody > tr').count(), 2, 'Pesquisa alcança modelo que estava na última página');
    await page.evaluate(() => { window.failPrices = true; });
    await page.getByRole('button', { name: 'Recarregar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Falha simulada' }).waitFor();
    await page.evaluate(() => { window.failPrices = false; });
    await page.getByRole('button', { name: 'Recarregar', exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar variações e preços juntos', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: 'Produto pai, fotos e variações', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/admin/products/new');
    assert.equal(new URL(page.url()).searchParams.get('family_model'), 'model-1549');
    assert.equal(await page.getByRole('dialog').count(), 0, 'O atalho deve ir ao cadastro único, sem outro seletor de fontes');
    assert.deepEqual(errors, []);
    console.log('Models pagination, bounded requests, full search and price retry checks passed');
    console.log(`Model actions browser checks passed. Screenshots: ${out}`);
} finally { await browser?.close(); await server.close(); }
