const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture() {
  const data = new Map(); let sequence = 0; const requests = [];
  const context = { exports: {}, crypto: { randomUUID: () => `attempt-${++sequence}` }, sessionStorage: {
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key),
  }, require: name => name === './print3dAccountClient' ? { print3dAccountClient: { requestStore: (...args) => requests.push(args) } } : { vpsClient: { post: (...args) => requests.push(args) } } };
  const source = fs.readFileSync(path.resolve(__dirname, '../services/print3dCheckoutClient.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { api: context.exports, data, requests };
}
test('checkout keeps the same request identity across retries and isolates changed contents', () => {
  const { api } = fixture(); const first = { items: [{ product_id: 'sku-a', quantity: 100 }], shipping_option_id: 'pac' };
  assert.equal(api.checkoutAttempt(first), api.checkoutAttempt(JSON.parse(JSON.stringify(first))));
  assert.notEqual(api.checkoutAttempt(first), api.checkoutAttempt({ ...first, shipping_option_id: 'sedex' }));
});
test('cart stores identifiers and quantities and rejects malformed drafts', () => {
  const { api, data } = fixture();
  api.saveCheckoutCart([{ product_id: 'a', quantity: 100 }]);
  assert.equal(JSON.stringify(api.readCheckoutCart()), '[{"product_id":"a","quantity":100}]');
  data.set('print3d_checkout_cart_v1', JSON.stringify([{ product_id: 'b', quantity: -1 }, { product_id: 'c', quantity: 1001 }, { product_id: 'd', quantity: 1.5 }]));
  assert.equal(api.readCheckoutCart().length, 0);
  data.set('print3d_checkout_cart_v1', 'invalid'); assert.equal(api.readCheckoutCart().length, 0);
});
test('successful checkout removes its cart and retry identity, preserving the MDV cart', () => {
  const { api, data } = fixture(); data.set('mdv-cart', 'keep');
  api.saveCheckoutCart([{ product_id: 'a', quantity: 1 }]); api.checkoutAttempt({}); api.clearCheckoutCart();
  assert.equal(api.readCheckoutCart().length, 0); assert.equal(data.get('mdv-cart'), 'keep'); assert.equal(data.has('print3d_checkout_attempt_v1'), false);
});
test('billing uses the isolated 3D session API and sends explicit payer email only when supplied', () => {
  const { api, requests } = fixture(); api.print3dCheckoutClient.pay('order-1', 'initial', 'key-1', 'example@example.test');
  assert.equal(requests[0][0], '/print3d/orders/order-1/payment');
  assert.equal(requests[0][1].payer_email, 'example@example.test');
  api.print3dCheckoutClient.pay('order-2', 'balance', 'key-2');
  assert.equal(Object.hasOwn(requests[1][1], 'payer_email'), false);
});
test('percentage input preserves two decimal places as integer basis points and refuses less than 50%', () => {
  const { api } = fixture();
  for (const [text, expected] of [['50', 5000], ['70', 7000], ['100', 10000], ['50,01', 5001], ['70.25', 7025], ['49', null], ['49.99', null], ['100.01', null], ['70.255', null], ['', null], ['1e2', null]]) assert.equal(api.percentageToBps(text), expected);
});
test('UI previews match the canonical server for all freight modes, percentages, and odd cent rounding', () => {
  const { api } = fixture(); const { buildPaymentTerms } = require('../services/print3dPaymentTerms.cjs');
  for (const subtotal of [1, 99, 100, 10001, 100000, 999999]) for (const freight of [0, 1, 13, 2500])
    for (const initial_payment_bps of [5000, 5001, 7000, 7025, 9999, 10000]) for (const shipping_payment_mode of ['later', 'full_now', 'split']) {
      const terms = { initial_payment_bps, shipping_payment_mode };
      assert.deepEqual(JSON.parse(JSON.stringify(api.paymentTermsPreview(subtotal, freight, terms))), buildPaymentTerms(subtotal, freight, terms));
    }
});
test('retry identity includes the entry and freight payment choice', () => {
  const { api } = fixture(); const payload = { items: [{ product_id: 'a', quantity: 1 }], payment_terms: { initial_payment_bps: 5000, shipping_payment_mode: 'later' } };
  const first = api.checkoutAttempt(payload);
  assert.notEqual(first, api.checkoutAttempt({ ...payload, payment_terms: { initial_payment_bps: 7000, shipping_payment_mode: 'later' } }));
  assert.notEqual(first, api.checkoutAttempt({ ...payload, payment_terms: { initial_payment_bps: 5000, shipping_payment_mode: 'split' } }));
});
