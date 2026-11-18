// Venda cancelada/estornada: a cliente nao ve mais os dados do aparelho
// (IMEI/serial/unidade), o admin continua vendo tudo, e o caixa registra o
// cancelamento uma unica vez.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  isCancelledSale,
  maskDeviceIdentifier,
  sanitizeCustomerSaleItems,
  sanitizeCustomerSale,
  shouldRecordSaleCancellationCashEvent,
} = require('../services/customerSaleVisibility.cjs');

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };

test('reconhece venda cancelada/estornada', () => {
  assert.equal(isCancelledSale({ payment_status: 'cancelled' }), true);
  assert.equal(isCancelledSale({ payment_status: 'refunded' }), true);
  assert.equal(isCancelledSale({ payment_status: 'Canceled' }), true);
  assert.equal(isCancelledSale({ payment_status: 'paid' }), false);
  assert.equal(isCancelledSale(null), false);
});

test('mascara IMEI mantendo 4 primeiros e 4 ultimos', () => {
  assert.equal(maskDeviceIdentifier('868499080873669'), '8684•••••••3669');
  assert.equal(maskDeviceIdentifier('12345678'), '••••••••');
  assert.equal(maskDeviceIdentifier(null), null);
  assert.equal(maskDeviceIdentifier(''), null);
});

const items = [
  { id: 'a', product_name: 'Poco X8', imei: '868499080873669', serialized_unit_id: 'u1', serial: 'S1', imei_2: '868499080873677' },
  { id: 'b', product_name: 'Copo', imei: null, serialized_unit_id: null },
];

test('venda cancelada: itens sem aparelho identificavel para a cliente', () => {
  const out = sanitizeCustomerSaleItems({ payment_status: 'cancelled' }, items);
  assert.equal(out[0].imei, '8684•••••••3669');
  assert.equal(out[0].imei_2, '8684•••••••3677');
  assert.equal(out[0].serial, null);
  assert.equal(out[0].serialized_unit_id, null);
  assert.equal(out[0].device_masked, true);
  assert.equal(out[1].imei, null);
  assert.equal(items[0].imei, '868499080873669', 'nao altera o objeto original (admin continua vendo)');
});

test('venda com item devolvido: só o item devolvido sai mascarado', () => {
  const out = sanitizeCustomerSaleItems({ payment_status: 'paid' }, items, new Set(['a']));
  assert.equal(out[0].imei, '8684•••••••3669');
  assert.equal(out[0].device_masked, true);
  assert.deepEqual(out[1], items[1]);
});

test('venda concluida: itens intactos', () => {
  const out = sanitizeCustomerSaleItems({ payment_status: 'paid' }, items);
  assert.deepEqual(out, items);
});

test('venda cancelada: log interno com IMEI nao vai para a cliente', () => {
  const sale = { id: 's', payment_status: 'cancelled', finalization_log: '{"serialized_unit":{"imei1":"868499080873669"}}' };
  const out = sanitizeCustomerSale(sale);
  assert.equal(out.finalization_log, null);
  assert.equal(out.device_masked, true);
  assert.equal(sale.finalization_log.includes('868499080873669'), true);
  assert.equal(sanitizeCustomerSale({ id: 's', payment_status: 'paid', finalization_log: 'x' }).finalization_log, 'x');
});

test('caixa: registra cancelamento so na transicao', () => {
  const after = { payment_status: 'cancelled', refund_cash_session_id: 'cx1' };
  assert.equal(shouldRecordSaleCancellationCashEvent({ payment_status: 'paid', refund_cash_session_id: null }, after), true);
  assert.equal(shouldRecordSaleCancellationCashEvent({ payment_status: 'cancelled', refund_cash_session_id: 'cx1' }, after), false, 'segundo PUT na mesma venda nao duplica');
  assert.equal(shouldRecordSaleCancellationCashEvent({ payment_status: 'cancelled', refund_cash_session_id: null }, after), true, 'vinculou o caixa agora');
  assert.equal(shouldRecordSaleCancellationCashEvent(null, after), true);
  assert.equal(shouldRecordSaleCancellationCashEvent({ payment_status: 'paid' }, { payment_status: 'cancelled', refund_cash_session_id: null }), false);
  assert.equal(shouldRecordSaleCancellationCashEvent({ payment_status: 'paid' }, { payment_status: 'paid', refund_cash_session_id: 'cx1' }), false);
});

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file} usa as regras nas rotas da cliente e do caixa`, () => {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /customerSaleVisibility\.cjs/);
    assert.match(src, /shouldRecordSaleCancellationCashEvent\(previousSaleRow, updatedRow\)/);
    assert.match(src, /items: sanitizeCustomerSaleItems\(sale, saleItemsBySaleId\.get\(String\(sale\.id\)\) \|\| \[\], returnedSaleItemIds\)/);
    assert.match(src, /FROM sale_return_items WHERE sale_id IN \(\?\)/);
    assert.match(src, /\.\.\.sanitizeCustomerSale\(sale\)/);
    assert.match(src, /'SELECT id, customer_id, payment_status FROM sales WHERE id = \? LIMIT 1'[\s\S]{0,400}isCancelledSale\(sale\)[\s\S]{0,120}documents: \[\]/);
    assert.match(src, /!access\.isAdmin && isCancelledSale\(sale\)\) return \{ sale_id: saleId, active: null, history: \[\], pending: \[\] \}/);
  });
}

console.log(`customer-sale-visibility: ${passed} ok`);
