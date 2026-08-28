const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseNotificationResource,
  classifyShipment,
  normalizeAvailableQuantity,
  buildEventKey,
  createPkcePair,
} = require('../services/mercadoLivreServer.cjs');

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
