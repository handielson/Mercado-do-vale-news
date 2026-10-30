import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { aggregateModelProducts, getModelIdentifierSections } from '../services/modelProductAggregator.js';
import { productImageList, resolveProductFamilyImages } from '../services/productFamilyImages.js';

const require = createRequire(import.meta.url);
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect width="160" height="240" rx="18" fill="#cbd5e1"/><rect x="10" y="10" width="140" height="220" rx="12" fill="#0f172a"/><circle cx="80" cy="20" r="4" fill="white"/></svg>');
const fixture = aggregateModelProducts({
    model: { id: 'model-test', name: 'Modelo de teste' },
    products: [
        { id: 'white', model_id: 'model-test', name: 'Modelo Branco', sku: 'TEST-01', images: [image], stock_quantity: 0, specs: { color: 'Branco', ram: '8GB', storage: '256GB' } },
        { id: 'black', model_id: 'model-test', name: 'Modelo Preto', sku: 'TEST-02', images: [], stock_quantity: 0, specs: { color: 'Preto', ram: '8GB', storage: '256GB' } },
    ], units: [], sales: [], saleItems: [], customers: [],
});
let firstState = true;
const react = { ...React, useState(initial) {
    if (firstState) { firstState = false; return React.useState(fixture); }
    return React.useState(initial);
} };
const source = fs.readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports,
    require(id) {
        if (id === 'react') return react;
        if (id === 'lucide-react') return require(id);
        if (id === 'react-router-dom') return { useNavigate: () => () => {}, useParams: () => ({ modelId: 'model-test' }) };
        if (id.endsWith('/modelProductAggregator.js')) return { aggregateModelProducts, getModelIdentifierSections };
        if (id.endsWith('/productFamilyImages.js')) return { productImageList, resolveProductFamilyImages };
        if (id.endsWith('/localCatalogPreview')) return { isLocalCatalogPreviewRuntime: () => false };
        return {};
    },
}, { filename: 'ModelProductAggregatorPage.js' });
const html = renderToStaticMarkup(React.createElement(exports.ModelProductAggregatorPage));
const cssFile = fs.readdirSync('dist/assets').find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, 'run npm build before the layout check');
const css = fs.readFileSync(path.join('dist/assets', cssFile), 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-model-panel-'));
try {
    const page = await browser.newPage();
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.setContent(`<style>${css}</style><div style="max-width:1120px;margin:20px auto;padding:16px">${html}</div>`);
        const group = page.getByRole('region', { name: 'Variação Branco', exact: true });
        const picture = group.getByRole('img', { name: 'Imagem principal · Branco' });
        await picture.waitFor();
        assert.equal(await picture.getAttribute('src'), image);
        const photo = await picture.boundingBox();
        const title = await group.getByRole('heading', { name: 'Branco', exact: true }).boundingBox();
        if (width > 640) assert.ok(title.x > photo.x + photo.width, 'desktop details beside photo');
        else assert.ok(title.y >= photo.y + photo.height, 'mobile details below photo');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page overflow');
        await page.getByRole('region', { name: 'Variação Preto', exact: true }).getByText('Sem imagem', { exact: true }).waitFor();
        await group.getByText('Disponíveis em estoque · Branco (0)', { exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, `${width}.png`), fullPage: true });
    }
    console.log(`Model panel image layout passed at desktop/mobile; preview: ${output}`);
} finally { await browser.close(); }
