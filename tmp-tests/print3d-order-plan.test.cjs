'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('variante pública é normalizada, fixada no plano e incluída no frete', async () => {
  const { normalizeVariantSnapshot } = require('../services/print3dStorefrontQuote.cjs');
  const { quoteItemsFingerprint } = require('../services/print3dShippingQuoteToken.cjs');
  const specs = { Material:' PETG ', Cor:'Preto', Tamanho:15, Acabamento:'Fosco', imei1:'privado', nas_path:'/privado', cost:100 };
  const expected = {material:'PETG',color:'Preto',size:'15',finish:'Fosco'};
  assert.deepEqual(normalizeVariantSnapshot(JSON.stringify(specs)),expected);
  for (const value of [null, 'invalid', [], {material:{internal:true}}]) assert.deepEqual(normalizeVariantSnapshot(value),{});
  const {state,connection} = fakeConnection();
  state.quote.variant_snapshot = normalizeVariantSnapshot(specs);
  const result = await savePrint3dOrderPlanOnConnection(connection,{orderId:state.order.id,quoteItems:[state.quote]});
  assert.deepEqual(JSON.parse(result.plan.items[0].variant_snapshot),expected);
  assert.equal((await savePrint3dOrderPlanOnConnection(connection,{orderId:state.order.id,quoteItems:[state.quote]})).replayed,true);
  const originalFingerprint=quoteItemsFingerprint([state.quote]);
  state.quote.variant_snapshot.color='Azul';
  assert.notEqual(quoteItemsFingerprint([state.quote]),originalFingerprint);
  await assert.rejects(savePrint3dOrderPlanOnConnection(connection,{orderId:state.order.id,quoteItems:[state.quote]}),/imutável/);
  assert.deepEqual(JSON.parse(result.plan.items[0].variant_snapshot),expected);
});

test('plano registra percentual escolhido e frete dentro das duas etapas', async () => {
  for (const [mode,initial,balance] of [['later',283,201],['full_now',363,121],['split',339,145]]) {
    const {state,connection} = fakeConnection();
    await savePrint3dOrderPlanOnConnection(connection,{orderId:state.order.id,quoteItems:[state.quote],
      paymentTerms:{initial_payment_bps:7000,shipping_payment_mode:mode}});
    assert.equal(state.plan.payment_terms_version,1);
    assert.equal(state.plan.deposit_amount_cents,283);
    assert.equal(state.plan.due_on_confirmation_cents,initial);
    assert.equal(state.plan.due_before_shipping_cents,balance);
    assert.equal((await readPrint3dPaymentCoverageOnConnection(connection,state.order.id)).due_on_confirmation_cents,initial);
    state.plan.shipping_initial_cents++;
    await assert.rejects(readPrint3dPaymentCoverageOnConnection(connection,state.order.id),/inconsistente/);
  }
});
test('plano legado versão zero conserva regra antiga sem reinterpretação',async()=>{
  const {state,connection} = fakeConnection();
  state.plan={subtotal_cents:404,ready_amount_cents:101,preorder_amount_cents:303,deposit_amount_cents:152,
    due_on_confirmation_cents:253,due_before_shipping_cents:151,payment_terms_version:0};
  assert.equal((await readPrint3dPaymentCoverageOnConnection(connection,state.order.id)).due_on_confirmation_cents,253);
  state.plan.payment_terms_version=2;
  await assert.rejects(readPrint3dPaymentCoverageOnConnection(connection,state.order.id),/Versão/);
});
test('entrada integral de produtos com frete posterior não declara quitação',async()=>{
  const {state,connection} = fakeConnection();
  await savePrint3dOrderPlanOnConnection(connection,{orderId:state.order.id,quoteItems:[state.quote],
    paymentTerms:{initial_payment_bps:10000,shipping_payment_mode:'later'}});
  const result = await recordVerifiedPrint3dPaymentOnConnection(connection,payment(404));
  assert.equal(result.coverage.initial_payment_covered,true);
  assert.equal(result.coverage.fully_paid,false);
  assert.equal(result.coverage.outstanding_cents,80);
});

const { quoteProduct } = require('../services/print3dStorefrontQuote.cjs');
const { buildPrint3dOrderPlan, savePrint3dOrderPlanOnConnection,
  recordVerifiedPrint3dPaymentOnConnection, readPrint3dPaymentCoverageOnConnection } = require('../services/print3dOrderPlan.cjs');

function fixture() {
  const quote = quoteProduct({ id: 'product-1', price_retail: 101, available_stock: 1,
    print3d_preorder_enabled: 1, production_days: 5 }, 4);
  // Representa uma solicitação já aprovada pelo administrador e convertida em pedido.
  quote.status = 'available';
  const order = { id: 'order-1', storefront: 'loja_3d', print3d_customer_id: 'customer-3d', customer_id: null,
    status: 'pending', payment_status: 'pending', subtotal: 404, shipping_cost: 80, total: 484, discount: 0 };
  const item = { id: 'item-1', order_id: order.id, product_id: quote.product_id, quantity: 4, unit_price: 101, subtotal: 404 };
  return { order, item, quote };
}

function fakeConnection() {
  const state = { ...fixture(), plan: null, receipts: [], calls: [] };
  const connection = { async query(sql, values) {
    state.calls.push(sql);
    if (sql.startsWith('SELECT * FROM orders')) return [[state.order]];
    if (sql.startsWith('SELECT * FROM order_items')) return [[state.item]];
    if (sql.startsWith('SELECT * FROM print3d_order_plans')) return [[state.plan].filter(Boolean)];
    if (sql.startsWith('INSERT INTO print3d_order_plans')) {
      const keys = sql.match(/\(([^)]+)\)/)[1].split(','); state.plan = Object.fromEntries(keys.map((key, index) => [key, values[index]])); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO print3d_order_item_plans')) return [{ affectedRows: 1 }];
    if (sql.includes('SUM(amount_cents)')) return [[{ confirmed_cents: state.receipts.reduce((sum, row) => sum + row.amount_cents, 0) }]];
    if (sql.includes('SELECT * FROM print3d_order_payment_receipts')) return [state.receipts.filter(row => row.provider === values[0] && (row.event_key === values[1] || row.provider_payment_id === values[2]))];
    if (sql.includes('INSERT INTO print3d_order_payment_receipts')) {
      const [id, order_id, event_key, provider, provider_payment_id, amount_cents, confirmed_at, payload_hash] = values;
      state.receipts.push({ id, order_id, event_key, provider, provider_payment_id, amount_cents, confirmed_at, payload_hash }); return [{ affectedRows: 1 }];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  return { state, connection };
}
const payment = amountCents => ({ orderId: 'order-1', eventKey: 'event-1', provider: 'verified-test-adapter',
  providerPaymentId: 'payment-1', amountCents, confirmedAt: '2026-09-27T12:00:00.000Z' });

test('plano preserva divisão pronta/encomenda com mínimo de 50% de todos os produtos', () => {
  const { order, item, quote } = fixture();
  const plan = buildPrint3dOrderPlan(order, [item], [quote]);
  assert.equal(plan.items[0].preorder_quantity, 3);
  assert.equal(plan.deposit_amount_cents, 202);
  assert.equal(plan.due_on_confirmation_cents, 202);
  assert.equal(plan.due_before_shipping_cents, 282);
  assert.equal(plan.subtotal_cents, 404);
});

test('rejeita cotação adulterada, item alheio, divisão e valor do pedido diferentes', () => {
  const { order, item, quote } = fixture();
  for (const changed of [{ ...quote, deposit_amount: 1 }, { ...quote, ready_quantity: 2 }, { ...quote, status: 'unavailable' },
    { ...quote, unit_price: 100 }, { ...quote, production_days: 0 }]) assert.throws(() => buildPrint3dOrderPlan(order, [item], [changed]));
  assert.throws(() => buildPrint3dOrderPlan(order, [{ ...item, order_id: 'other' }], [quote]));
  assert.throws(() => buildPrint3dOrderPlan({ ...order, total: 400 }, [item], [quote]));
  assert.throws(() => buildPrint3dOrderPlan({ ...order, discount: 10, total: 474 }, [item], [quote]));
});

test('nunca aceita pedido MDV, conta MDV, cancelamento ou estorno', () => {
  const { order, item, quote } = fixture();
  for (const changed of [{ storefront: 'mercado_do_vale' }, { customer_id: 'customer-mdv' }, { print3d_customer_id: null },
    { status: 'cancelled' }, { payment_status: 'refunded' }]) assert.throws(() => buildPrint3dOrderPlan({ ...order, ...changed }, [item], [quote]));
});

test('plano persistido é idempotente e imutável, trava o pedido primeiro', async () => {
  const { state, connection } = fakeConnection();
  const input = { orderId: state.order.id, quoteItems: [state.quote] };
  assert.equal((await savePrint3dOrderPlanOnConnection(connection, input)).replayed, false);
  assert.equal((await savePrint3dOrderPlanOnConnection(connection, input)).replayed, true);
  assert.match(state.calls[0], /orders.*FOR UPDATE/);
  state.plan.plan_hash = 'alterado';
  await assert.rejects(savePrint3dOrderPlanOnConnection(connection, input), /imutável/);
});

test('sem ledger mesmo orders.paid não libera produção; soma parcial só libera na entrada exata', async () => {
  const { state, connection } = fakeConnection();
  await savePrint3dOrderPlanOnConnection(connection, { orderId: state.order.id, quoteItems: [state.quote] });
  state.order.payment_status = 'paid';
  assert.equal((await readPrint3dPaymentCoverageOnConnection(connection, state.order.id)).initial_payment_covered, false);
  state.order.payment_status = 'pending';
  const partial = await recordVerifiedPrint3dPaymentOnConnection(connection, payment(201));
  assert.equal(partial.coverage.initial_payment_covered, false);
  const initial = await recordVerifiedPrint3dPaymentOnConnection(connection, { ...payment(1), eventKey: 'event-2', providerPaymentId: 'payment-2' });
  assert.equal(initial.coverage.initial_payment_covered, true);
  assert.equal(initial.coverage.outstanding_cents, 282); // saldo produtos 202 + frete 80
  assert.equal(initial.coverage.fully_paid, false);
  assert.equal(state.order.payment_status, 'pending');
  assert.ok(state.calls.every(sql => !sql.startsWith('UPDATE orders')));
});

test('webhook repetido não duplica entrada e chave reutilizada com outro valor falha', async () => {
  const { state, connection } = fakeConnection();
  await savePrint3dOrderPlanOnConnection(connection, { orderId: state.order.id, quoteItems: [state.quote] });
  const first = await recordVerifiedPrint3dPaymentOnConnection(connection, payment(253));
  const retry = await recordVerifiedPrint3dPaymentOnConnection(connection, payment(253));
  assert.equal(first.receipt_id, retry.receipt_id);
  assert.equal(retry.replayed, true);
  assert.equal(state.receipts.length, 1);
  await assert.rejects(recordVerifiedPrint3dPaymentOnConnection(connection, payment(252)), /dados diferentes/);
  const alias = await recordVerifiedPrint3dPaymentOnConnection(connection, { ...payment(253), eventKey: 'retry-event' });
  assert.equal(alias.replayed, true);
  assert.equal(state.receipts.length, 1);
});

test('sem plano ou acima do saldo não grava confirmação', async () => {
  const { state, connection } = fakeConnection();
  await assert.rejects(recordVerifiedPrint3dPaymentOnConnection(connection, payment(253)), /sem plano/);
  await savePrint3dOrderPlanOnConnection(connection, { orderId: state.order.id, quoteItems: [state.quote] });
  await assert.rejects(recordVerifiedPrint3dPaymentOnConnection(connection, payment(485)), /supera o saldo/);
  await recordVerifiedPrint3dPaymentOnConnection(connection, payment(484));
  assert.equal((await readPrint3dPaymentCoverageOnConnection(connection, state.order.id)).fully_paid, true);
});

test('plano corrompido não permite reduzir valor da entrada', async () => {
  const { state, connection } = fakeConnection();
  await savePrint3dOrderPlanOnConnection(connection, { orderId: state.order.id, quoteItems: [state.quote] });
  state.plan.due_on_confirmation_cents = 0;
  await assert.rejects(readPrint3dPaymentCoverageOnConnection(connection, state.order.id));
});
