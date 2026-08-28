const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseNotificationResource,
  classifyShipment,
  normalizeAvailableQuantity,
  buildEventKey,
  createPkcePair,
  selectDcePdfDocument,
} = require('../services/mercadoLivreServer.cjs');
const { buildMercadoLivreSummaryData } = require('../scripts/mercado-livre-print-core.cjs');
const { createShopeeSeparationSummaryPdf } = require('../scripts/shopee-separation-summary.cjs');

test('interpreta notificacoes de pedido e remessa sem confiar no payload inteiro', () => {
  assert.deepEqual(parseNotificationResource({ topic: 'orders_v2', resource: '/orders/123' }), {
    topic: 'orders_v2', resourceId: '123', kind: 'order',
  });
  assert.deepEqual(parseNotificationResource({ topic: 'shipments', resource: '/shipments/456' }), {
    topic: 'shipments', resourceId: '456', kind: 'shipment',
  });
  assert.equal(parseNotificationResource({ topic: 'questions', resource: '/questions/1' }), null);
});

test('DC-e pendente nunca e tratada como etiqueta pronta', () => {
  assert.deepEqual(classifyShipment({ status: 'ready_to_ship', substatus: 'invoice_pending' }), {
    printable: false, needsDce: true,
  });
  assert.deepEqual(classifyShipment({ status: 'ready_to_ship', substatus: 'ready_to_print' }), {
    printable: true, needsDce: false,
  });
});

test('estoque enviado ao marketplace e inteiro, finito e nunca negativo', () => {
  assert.equal(normalizeAvailableQuantity(7.9), 7);
  assert.equal(normalizeAvailableQuantity(-5), 0);
  assert.equal(normalizeAvailableQuantity('invalido'), 0);
});

test('chave de idempotencia ignora a contagem de reenvios do mesmo evento', () => {
  const a = buildEventKey({ topic: 'orders_v2', resource: '/orders/1', sent: 'x', attempts: 1 });
  const b = buildEventKey({ topic: 'orders_v2', resource: '/orders/1', sent: 'x', attempts: 2 });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('PKCE gera verificador forte e desafio S256 sem caracteres inseguros', () => {
  const pair = createPkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(pair.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(pair.verifier, pair.challenge);
});

test('seleciona somente PDF de DC-e concluida e emitida', () => {
  assert.equal(selectDcePdfDocument({ status: 'pending', documents: [] }), null);
  assert.equal(selectDcePdfDocument({ status: 'completed', documents: [{ dce_key: 'x', status: 'rejected', files: [{ format: 'pdf' }] }] }), null);
  assert.deepEqual(selectDcePdfDocument({
    status: 'completed',
    documents: [{ dce_key: 'dce-123', status: 'issued', files: [{ format: 'xml' }, { format: 'pdf' }] }],
  }), { dceKey: 'dce-123' });
});

test('monta comprovante Mercado Livre a partir do pedido da fila', () => {
  const summary = buildMercadoLivreSummaryData({
    orderId: '2001', trackingNumber: 'BR123',
    payload: JSON.stringify({ order: { total_amount: 99.9, buyer: { nickname: 'CLIENTE' }, order_items: [{ quantity: 2, item: { title: 'Capa', seller_sku: 'CAPA-1', variation_attributes: [{ value_name: 'Preto' }] } }] } }),
  });
  assert.equal(summary.marketplaceName, 'MERCADO LIVRE');
  assert.equal(summary.orderSn, '2001');
  assert.equal(summary.items[0].sku, 'CAPA-1');
  assert.equal(summary.items[0].quantity, 2);
  assert.equal(summary.items[0].modelName, 'Preto');
});

test('gera comprovante Mercado Livre no formato termico existente', async () => {
  const buffer = await createShopeeSeparationSummaryPdf(buildMercadoLivreSummaryData({
    orderId: '2002', trackingNumber: 'BR456',
    payload: { order: { date_created: '2026-08-28T17:30:00-03:00', order_items: [{ quantity: 1, item: { title: 'Película', seller_sku: 'PEL-1' } }] } },
  }));
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
});
