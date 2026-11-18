// Parte 3: cálculos da devolução de itens (venda real anonimizada da Eliany, 8D7563B4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/unit-timeline-868499080873669.json');
const {
  itemPaidValues, returnableItems, planSameMethodRefund, validateOtherRefunds,
  requiredProofs, returnStatusOf, amountInWords,
} = require('../services/saleReturnCore.cjs');

const sale = fixture.sales[0];
const items = fixture.saleItems;
const poco = items.find(i => i.product_sku === 'POCO0001-03');
const payments = JSON.parse(sale.payment_methods);

test('valor pago de cada item: proporcional ao desconto, soma fecha no total sem taxas', () => {
  const values = itemPaidValues(sale, items);
  assert.equal(values.get(poco.id), 191617);
  const sum = [...values.values()].reduce((a, b) => a + b, 0);
  assert.equal(sum, 215118 - 19686);                       // total − taxa do cartão
});

test('devolvível desconta o que já voltou em devoluções anteriores', () => {
  const twoUnits = items.map(i => (i.product_sku === 'CTT473B' ? { ...i, quantity: 2, total: 4980, subtotal: 4980 } : i));
  const rows = returnableItems({ ...sale, total: 217608 }, twoUnits, [{ sale_item_id: twoUnits[0].id, quantity: 1 }]);
  const cup = rows.find(r => r.sku === 'CTT473B');
  assert.equal(cup.quantity, 2); assert.equal(cup.returnedQuantity, 1); assert.equal(cup.returnableQuantity, 1);
  const p = rows.find(r => r.sku === 'POCO0001-03');
  assert.equal(p.serializedUnitId, poco.serialized_unit_id);
  assert.equal(p.imei, '868499080873669');
  assert.equal(p.unitValueCents, p.returnableQuantity ? itemPaidValues({ ...sale, total: 217608 }, twoUnits).get(poco.id) : 0);
});

test('mesma forma: dinheiro primeiro, resto no crédito com juros proporcionais', () => {
  const plan = planSameMethodRefund(payments, 191617, new Map());
  assert.deepEqual(plan.map(p => [p.paymentIndex, p.method, p.goodsCents, p.refundCents]), [
    [0, 'money', 30000, 30000],
    [1, 'credit', 161617, 180849],
  ]);
});

test('mesma forma da venda inteira devolve exatamente o que ela pagou', () => {
  const plan = planSameMethodRefund(payments, 195432, new Map());
  assert.equal(plan.reduce((a, p) => a + p.refundCents, 0), 215118);
});

test('mesma forma respeita estorno anterior por forma de pagamento', () => {
  const plan = planSameMethodRefund(payments, 50000, new Map([[0, 30000]]));   // dinheiro já devolvido
  assert.deepEqual(plan.map(p => [p.method, p.goodsCents]), [['credit', 50000]]);
});

test('mesma forma acima do que entrou → erro 409', () => {
  assert.throws(() => planSameMethodRefund(payments, 195433, new Map()), e => e.statusCode === 409);
});

test('mesma forma com Pix do Mercado Pago leva o id do pagamento', () => {
  const plan = planSameMethodRefund([{ method: 'pix', amount: 1000, total_with_fee: 1000, mercado_pago_payment_id: '123' }], 400, new Map());
  assert.deepEqual(plan.map(p => [p.method, p.refundCents, p.gatewayPaymentId]), [['pix', 400, '123']]);
});

test('outra forma: métodos aceitos e soma igual ao total', () => {
  assert.deepEqual(validateOtherRefunds([{ method: 'pix', amount_cents: 100 }, { method: 'money', amount_cents: 50 }], 150).map(r => r.method), ['pix', 'money']);
  assert.throws(() => validateOtherRefunds([{ method: 'pix', amount_cents: 100 }], 150), e => e.statusCode === 400);
  assert.throws(() => validateOtherRefunds([{ method: 'cheque', amount_cents: 150 }], 150), e => e.statusCode === 400);
  assert.throws(() => validateOtherRefunds([{ method: 'pix', amount_cents: 0 }, { method: 'money', amount_cents: 150 }], 150), e => e.statusCode === 400);
});

test('comprovante obrigatório: Pix manual, transferência e cartão; dinheiro e Pix do Mercado Pago não', () => {
  const refunds = [
    { id: 'a', method: 'money' }, { id: 'b', method: 'pix' }, { id: 'c', method: 'pix', gateway_refund_id: 'mp-1' },
    { id: 'd', method: 'credit' }, { id: 'e', method: 'transfer' }, { id: 'f', method: 'card' }, { id: 'g', method: 'debit' },
  ];
  assert.deepEqual(requiredProofs(refunds).sort(), ['b', 'd', 'e', 'f', 'g']);
});

test('fica finalizada só com recibo assinado e todos os comprovantes', () => {
  const refunds = [{ id: 'a', method: 'money' }, { id: 'd', method: 'credit' }];
  assert.equal(returnStatusOf({ refunds, files: [] }), 'pendente');
  assert.equal(returnStatusOf({ refunds, files: [{ kind: 'signed' }] }), 'pendente');
  assert.equal(returnStatusOf({ refunds, files: [{ kind: 'signed' }, { kind: 'proof', refund_id: 'd' }] }), 'finalizada');
  assert.equal(returnStatusOf({ refunds: [{ id: 'a', method: 'money' }], files: [{ kind: 'signed' }] }), 'finalizada');
});

test('valor por extenso para a declaração de recebimento', () => {
  assert.equal(amountInWords(30000), 'trezentos reais');
  assert.equal(amountInWords(191617), 'mil novecentos e dezesseis reais e dezessete centavos');
  assert.equal(amountInWords(215118), 'dois mil cento e cinquenta e um reais e dezoito centavos');
  assert.equal(amountInWords(100), 'um real');
  assert.equal(amountInWords(5), 'cinco centavos');
  assert.equal(amountInWords(100000000), 'um milhão de reais');
});

test('crédito devolvido aos poucos nunca passa do que o cliente pagou com juros', () => {
  const credit = payments[1];
  const amount = Math.round(credit.amount), withFee = Math.round(credit.total_with_fee);
  const goodsByIndex = new Map([[0, Math.round(payments[0].amount)]]);
  const feeByIndex = new Map();
  let total = 0;
  // pedaços que arredondam para cima no juros
  let piece = 1; while (Math.round(piece * withFee / amount) - piece * withFee / amount <= 0.3) piece++;
  let left = amount;
  while (left > 0) {
    const goods = Math.min(piece, left);
    const [step] = planSameMethodRefund(payments, goods, goodsByIndex, feeByIndex);
    goodsByIndex.set(1, (goodsByIndex.get(1) || 0) + step.goodsCents);
    feeByIndex.set(1, (feeByIndex.get(1) || 0) + step.refundCents);
    total += step.refundCents; left -= goods;
  }
  assert.equal(total, withFee);
});
