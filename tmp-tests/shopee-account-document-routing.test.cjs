const assert = require('node:assert/strict');
const { test } = require('node:test');
const { prepareShopeeOrderShipment } = require('../scripts/shopee-auto-print.cjs');

function successfulActionRecorder() {
    const calls = [];
    return {
        calls,
        callAction: async (action, payload, connectionId) => {
            calls.push({ action, payload, connectionId });
            return { ok: true, status: 200, data: { success: true } };
        },
    };
}

test('conta M envia NF-e antes de preparar o envio', async () => {
    const recorder = successfulActionRecorder();
    const result = await prepareShopeeOrderShipment({
        connection: { id: 'primary', displayName: 'Mercado do Vale', sellerType: 'business' },
        orderSn: 'TESTE-M-001',
        callAction: recorder.callAction,
        wait: async () => {},
    });

    assert.equal(result.success, true);
    assert.deepEqual(recorder.calls.map(call => call.action), ['upload_invoice', 'ship_order']);
    assert.ok(recorder.calls.every(call => call.connectionId === 'primary'));
});

test('conta G nunca chama NF-e/Bling e prepara o envio na conexao correta', async () => {
    const recorder = successfulActionRecorder();
    const result = await prepareShopeeOrderShipment({
        connection: { id: 'connection-g', displayName: 'Shopee - Glaucia', sellerType: 'individual' },
        orderSn: 'TESTE-G-001',
        callAction: recorder.callAction,
        wait: async () => {},
    });

    assert.equal(result.success, true);
    assert.deepEqual(recorder.calls.map(call => call.action), ['ship_order']);
    assert.ok(recorder.calls.every(call => call.connectionId === 'connection-g'));
});

test('exigencia de nota na conta G vira intervencao de documento PF', async () => {
    const calls = [];
    const result = await prepareShopeeOrderShipment({
        connection: { id: 'connection-g', displayName: 'Shopee - Glaucia', sellerType: 'individual' },
        orderSn: 'TESTE-G-002',
        callAction: async (action) => {
            calls.push(action);
            return { ok: false, status: 409, data: { error: 'lack_of_invoice_data', message: 'Nota fiscal obrigatoria' } };
        },
        wait: async () => {},
        maxAttempts: 2,
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'personal_document');
    assert.deepEqual(calls, ['ship_order', 'ship_order']);
    assert.ok(!calls.includes('upload_invoice'));
});
