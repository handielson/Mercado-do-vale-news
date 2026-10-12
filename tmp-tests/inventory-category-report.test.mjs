import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { buildInventoryCategoryRows, renderInventoryCategoryReport } from '../utils/inventoryCategoryReport.mjs';

test('category report uses available units and never resurrects sold unit history from legacy specs', () => {
    const products = [
        { id: 'phone', name: 'Celular', sku: 'P1', category_id: 'c', stock_quantity: 99, specs: { serial: 'old' } },
        { id: 'sold', name: 'Vendido', category_id: 'c', stock_quantity: 10, specs: { imei1: 'legacy' } },
        { id: 'other', name: 'Outra categoria', category_id: 'other', stock_quantity: 2 },
        { id: 'parent', name: 'Família', category_id: 'c', stock_quantity: 99, is_parent: true },
    ];
    const units = [
        { product_id: 'phone', status: 'available', serial: 'TEST-SERIAL', imei_1: 'TEST-IMEI-1', imei_2: 'TEST-IMEI-2' },
        ...['reserved', 'sold', 'hidden', 'scrapped', 'rma'].map(status => ({ product_id: 'phone', status })),
        { product_id: 'sold', status: 'sold' },
    ];
    const rows = buildInventoryCategoryRows(products, units, 'c');
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].quantity, rows[0].serial, rows[0].imei1, rows[0].imei2],
        [1, 'TEST-SERIAL', 'TEST-IMEI-1', 'TEST-IMEI-2']);
});

test('quantity stock and available legacy identifiers survive without duplicating modern units', () => {
    const rows = buildInventoryCategoryRows([
        { id: 'normal', name: 'Cabo', category_id: 'c', stock_quantity: '12' },
        { id: 'legacy', name: 'Legado', category_id: 'c', stock_quantity: 1, specs: { serial: 'TEST-LEGACY', imei1: 'TEST-I1', imei2: 'TEST-I2' } },
        { id: 'empty', name: 'Esgotado', category_id: 'c', stock_quantity: 0 },
        { id: 'reserved', name: 'Reservado', category_id: 'c', stock_quantity: 1, specs: { unit_status: 'reserved' } },
    ], [], 'c');
    assert.equal(rows.length, 2);
    assert.equal(rows.reduce((sum, row) => sum + row.quantity, 0), 13);
    assert.equal(rows[1].serial, 'TEST-LEGACY');
    assert.equal(rows[0].serial, '-');
});

test('print markup escapes category, product and identifiers and supplies repeatable A4 headers', () => {
    const html = renderInventoryCategoryReport([
        { name: '<script>bad</script>', sku: '"sku"', variation: 'A&B', quantity: 1,
            serial: '<serial>', imei1: 'TEST-I1', imei2: 'TEST-I2' },
    ], '<categoria>', new Date('2026-10-12T15:00:00Z'));
    assert.ok(!html.includes('<script>bad'));
    assert.ok(html.includes('&lt;categoria&gt;'));
    assert.ok(html.includes('&lt;serial&gt;'));
    assert.ok(html.includes('12/10/2026, 12:00'));
    assert.match(html, /A4 landscape/);
    assert.match(html, /table-header-group/);
    assert.match(html, /Conferido/);
    assert.match(html, /IMEI 1.*IMEI 2/);
});

function reportService(get, getProducts = async () => []) {
    const source = readFileSync(new URL('../services/inventory.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, URLSearchParams, Date, console, require: (name) => {
        if (name === './vpsClient') return { vpsClient: { get } };
        if (name === './vpsApiService') return { vpsApiService: { getProducts } };
        if (name === './companyContext') return { getCompanyId: async () => 'test-company' };
        if (name === '../utils/inventoryCategoryReport.mjs') return { buildInventoryCategoryRows };
        if (name === '../utils/promoPrice') return { getEffectiveRetailPrice: product => Number(product.price_promo || product.price_retail || 0) };
        return {};
    } });
    return exports.inventoryService;
}

test('report reads fresh complete paginated stock and company-scoped unit history', async () => {
    const calls = [];
    const service = reportService(async path => {
        calls.push(path);
        if (path.startsWith('/units')) return [];
        const query = new URLSearchParams(path.split('?')[1]);
        const offset = Number(query.get('offset'));
        return Array.from({ length: offset === 0 ? 500 : 1 }, (_, index) => ({
            id: String(offset + index), name: 'Produto', category_id: 'c', stock_quantity: 1,
        }));
    });
    const rows = await service.getCategoryStockReport('c');
    assert.equal(rows.length, 501);
    assert.equal(calls.length, 3);
    assert.match(calls[0], /company_id=test-company&status=all&_t=/);
    assert.match(calls[2], /offset=500/);
    assert.match(calls[1], /category=c&status=all&compact=true/);
});

test('failed unit lookup or later product page rejects instead of returning a partial report', async () => {
    await assert.rejects(reportService(async () => null).getCategoryStockReport('c'), /unidades/);
    const service = reportService(async path => {
        if (path.startsWith('/units')) return [];
        if (new URLSearchParams(path.split('?')[1]).get('offset') === '0') return Array(500).fill({});
        throw new Error('network failure');
    });
    await assert.rejects(service.getCategoryStockReport('c'), /network failure/);
});

test('purchase cost uses individual unit cost, average uses available quantities, and missing cost stays unknown', () => {
    const rows = buildInventoryCategoryRows([
        { id: 'p', name: 'Celular', category_id: 'c', price_cost: 200000, price_retail: 300000, report_sale_price: 280000 },
        { id: 'missing', name: 'Sem custo', category_id: 'c', stock_quantity: 2 },
    ], [
        { product_id: 'p', status: 'available', cost_price: 100000 },
        { product_id: 'p', status: 'available', cost_price: null },
        { product_id: 'p', status: 'sold', cost_price: 900000 },
    ], 'c');
    assert.equal(rows[0].purchaseCost, 100000);
    assert.equal(rows[1].purchaseCost, 200000);
    assert.equal(rows[0].averagePurchaseCost, 150000);
    assert.equal(rows[1].averagePurchaseCost, 150000);
    assert.equal(rows[0].salePrice, 280000);
    assert.equal(rows[2].purchaseCost, null);
    assert.equal(rows[2].averagePurchaseCost, null);
    const plain = renderInventoryCategoryReport(rows, 'c');
    assert.doesNotMatch(plain, /Compra \(unit\.\)|Compra média \(unit\.\)|Venda à vista \(unit\.\)/);
    const priced = renderInventoryCategoryReport(rows, 'c', new Date(), {
        showPurchaseCost: true, showAverageCost: true, showSalePrice: true,
    });
    assert.match(priced, /1\.000,00/);
    assert.match(priced, /1\.500,00/);
    assert.match(priced, /2\.800,00/);
    assert.match(priced, /Não informado/);
    assert.doesNotMatch(priced, /window.onload|window.print/);
});

test('parent category report accepts explicit subtree IDs without mixing other categories', () => {
    const rows = buildInventoryCategoryRows(['parent', 'child', 'other'].map(category_id => ({
        id: category_id, name: category_id, category_id, stock_quantity: 1,
    })), [], ['parent', 'child']);
    assert.equal(rows.length, 2);
});

test('available status plus positive stock finds modern units and quantity stock without legacy unit_status', async () => {
    const service = reportService(async () => [
        { id: 'available', product_id: 'p', status: 'available', serial: 'TEST-UNIT' },
        { id: 'sold', product_id: 'p', status: 'sold' },
        { id: 'reserved', product_id: 'p', status: 'reserved' },
        { id: 'sold-only', product_id: 'old', status: 'sold' },
    ], async () => [
        { id: 'p', name: 'Celular', category_id: 'c', stock_quantity: 99, specs: {} },
        { id: 'quantity', name: 'Cabo', category_id: 'c', stock_quantity: 4, specs: {} },
        { id: 'old', name: 'Vendido', category_id: 'c', stock_quantity: 1, specs: { serial: 'TEST-OLD' } },
        { id: 'empty', name: 'Esgotado', category_id: 'c', stock_quantity: 0, specs: {} },
    ]);
    const groups = await service.getInventoryGrouped({ category_id: 'c', status: 'available', only_available: true });
    assert.equal(groups.length, 2);
    const phone = groups.find(group => group.name === 'Celular');
    assert.equal(phone.is_serialized, true);
    assert.equal(phone.available, 1);
    assert.equal(phone.total_units, 1);
    assert.equal(phone.units.length, 1);
    assert.equal(phone.units[0].id, 'available');
    assert.equal(phone.units[0].serial, 'TEST-UNIT');
    const sold = await service.getInventoryGrouped({ category_id: 'c', status: 'sold' });
    assert.equal(sold.length, 2);
    assert.equal(sold.find(group => group.name === 'Celular').units[0].id, 'sold');
    assert.equal((await service.getInventoryGrouped({ status: 'reserved', only_available: true })).length, 0);
});

test('filter controls expose names, selected status and stock type, and correct initial sort direction', () => {
    const source = readFileSync(new URL('../components/inventory/InventoryFilters.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const exports = {};
    const require = createRequire(import.meta.url);
    vm.runInNewContext(code, { exports, require });
    const html = renderToStaticMarkup(React.createElement(exports.InventoryFilters, {
        filters: { category_id: 'c', status: 'available', only_serialized: true, only_available: true },
        categories: [{ id: 'c', name: 'Smartphones' }], brands: [], onFiltersChange() {},
    }));
    for (const name of ['Categoria', 'Marca', 'Status da unidade', 'Tipo de estoque', 'Ordenar por']) {
        assert.ok(html.includes(`aria-label="${name}"`));
    }
    assert.match(html, /value="available" selected=""/);
    assert.match(html, /value="serialized" selected=""/);
    assert.match(html, /aria-label="Ordem crescente"/);
    assert.match(html, /Smartphones/);
    assert.match(html, /Filtrar estoque/);
    const page = readFileSync(new URL('../pages/admin/inventory/InventoryPage.tsx', import.meta.url), 'utf8');
    assert.match(page, /Sem valores/);
    assert.match(page, /Com valores/);
    assert.match(page, /showPurchaseCost: false, showAverageCost: false, showSalePrice: false/);
    assert.match(page, /showPurchaseCost: true, showAverageCost: true, showSalePrice: true/);
});
