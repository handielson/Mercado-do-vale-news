import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

function fixture(restored = [], units = []) {
    const calls = [], released = [];
    const source = fs.readFileSync(new URL('../services/saleService.ts', import.meta.url), 'utf8');
    const functions = source.slice(source.indexOf('type SaleStockRestoreItem'), source.indexOf('interface TableDataResponse'));
    const context = vm.createContext({
        console, Map, Set,
        UnitStatus: { SOLD: 'sold', RESERVED: 'reserved' },
        stockLocationService: { restoreSaleStockByLocation: async () => restored },
        unitService: { listByIds: async () => units, release: async id => released.push(id) },
        syncStockToBling: async (...args) => calls.push(args),
    });
    vm.runInContext(stripTypeScriptTypes(functions + '\nglobalThis.restore = restoreCancelledSaleInventory;'), context);
    return { restore: context.restore, calls, released };
}

test('retorno parcial envia apenas a quantidade confirmada, mesmo com linhas repetidas', async () => {
    const f = fixture([{ product_id: 'p', quantity_restored: 1 }]);
    await f.restore('sale', [{ product_id: 'p', quantity: 2 }, { product_id: 'p', quantity: 2 }], 'Cancelamento');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][0], 'p');
    assert.equal(f.calls[0][1], 1);
    assert.equal(f.calls[0][3].operation, 'E');
});

test('divide o retorno confirmado pelas linhas, preservando seleção do combo', async () => {
    const combo = [{ product_id: 'component' }];
    const f = fixture([{ product_id: 'p', quantity_restored: 3 }]);
    await f.restore('sale', [{ product_id: 'p', quantity: 2, combo_selections: combo }, { product_id: 'p', quantity: 2 }], 'Cancelamento');
    assert.deepEqual(f.calls.map(call => call[1]), [2, 1]);
    assert.equal(f.calls[0][3].comboSelections, combo);
});

test('repetição concluída não envia novo retorno ao Bling', async () => {
    const f = fixture();
    await f.restore('sale', [{ product_id: 'p', quantity: 2 }], 'Cancelamento');
    assert.equal(f.calls.length, 0);
});

test('aparelhos retornam somente se ainda pertencem à venda, uma vez por unidade', async () => {
    const f = fixture([], [
        { id: 'u1', sale_id: 'sale', status: 'sold' },
        { id: 'u2', sale_id: 'other', status: 'sold' },
        { id: 'u3', sale_id: 'sale', status: 'available' },
    ]);
    await f.restore('sale', [
        { product_id: 'p', quantity: 1, serialized_unit_id: 'u1' },
        { product_id: 'p', quantity: 1, serialized_unit_id: 'u1' },
        { product_id: 'p', quantity: 1, serialized_unit_id: 'u2' },
        { product_id: 'p', quantity: 1, serialized_unit_id: 'u3' },
    ], 'Cancelamento');
    assert.deepEqual(f.released, ['u1']);
    assert.deepEqual(f.calls.map(call => call[1]), [1]);
});
