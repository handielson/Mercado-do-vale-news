const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQuoteItems, quoteProduct, quotePaymentSchedule } = require('../services/print3dStorefrontQuote.cjs');

test('pronta entrega também aceita entrada mínima de metade', () => {
  const ready = quoteProduct({ id:'ready',price_retail:1901,available_stock:1 },1);
  assert.equal(ready.deposit_amount,951);
  assert.equal(quotePaymentSchedule([ready]).due_on_confirmation,951);
});
test('mínimo global arredonda apenas uma vez com múltiplas linhas ímpares', () => {
  const items = ['a','b','c'].map(id => quoteProduct({id,price_retail:101,available_stock:1},1));
  assert.equal(items.reduce((sum,item) => sum+item.deposit_amount,0),153);
  assert.equal(quotePaymentSchedule(items).due_on_confirmation,152);
  assert.equal(quotePaymentSchedule(items).due_before_shipping,151);
});


test('quantidades inválidas e duplicadas não entram na cotação', () => {
  assert.throws(() => validateQuoteItems([{ product_id: 'p1', quantity: 1.5 }]), /inválidos/);
  assert.throws(() => validateQuoteItems([{ product_id: 'p1', quantity: 1 }, { product_id: 'p1', quantity: 2 }]), /repetido/);
});

test('quantidade acima do estoque exige consulta, com ou sem prazo estimado', () => {
  const product = { id: 'p1', price_retail: 2000, available_stock: 1, print3d_preorder_enabled: 1,
    print3d_preorder_limit: 2, production_days: 4 };
  assert.equal(quoteProduct(product, 3).status, 'requires_consultation');
  assert.equal(quoteProduct(product, 4).status, 'requires_consultation');
  assert.equal(quoteProduct({ ...product, production_days: null }, 2).status, 'requires_consultation');
  assert.equal(quoteProduct({ ...product, print3d_preorder_enabled: 0 }, 2).status, 'unavailable');
});

test('quantidade em consulta não gera condição de pagamento', () => {
  const mixed = quoteProduct({ id: 'p1', price_retail: 5900, available_stock: 2,
    print3d_preorder_enabled: 1, production_days: 4 }, 4);
  assert.equal(mixed.status, 'requires_consultation');
  assert.equal(quotePaymentSchedule([mixed]), null);
});

test('centavo excedente fica na entrada e valores indisponíveis não geram cobrança', () => {
  const preorder = quoteProduct({ id: 'p1', price_retail: 1901, available_stock: 0,
    print3d_preorder_enabled: 1, production_days: 3 }, 1);
  assert.equal(preorder.deposit_amount, 951);
  assert.equal(preorder.balance_before_shipping, 950);
  assert.equal(quotePaymentSchedule([preorder]), null);
  assert.equal(quotePaymentSchedule([{ ...preorder, status: 'unavailable' }]), null);
});

test('rejeita valores que perderiam precisão em centavos', () => {
  assert.throws(() => quoteProduct({ id: 'p1', price_retail: Number.MAX_SAFE_INTEGER,
    available_stock: 2 }, 2), /limite seguro/);
  const item = quoteProduct({ id: 'p1', price_retail: Number.MAX_SAFE_INTEGER - 1,
    available_stock: 1 }, 1);
  assert.throws(() => quotePaymentSchedule([item, { ...item, product_id: 'p2' }]), /limite seguro/);
});
