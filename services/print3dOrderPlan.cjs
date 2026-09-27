'use strict';

const crypto = require('node:crypto');
const { quoteProduct, quotePaymentSchedule, normalizeVariantSnapshot } = require('./print3dStorefrontQuote.cjs');
const { buildPaymentTerms } = require('./print3dPaymentTerms.cjs');

function fail(message, statusCode = 409) { const error = new Error(message); error.statusCode = statusCode; throw error; }
function integer(value, min = 0) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min) fail('Valor inteiro inválido no plano 3D.', 400);
  return number;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function eligibleOrder(order) {
  if (!order || order.storefront !== 'loja_3d' || !order.print3d_customer_id || order.customer_id) fail('Pedido não pertence a uma conta independente 3D.');
  if (['cancelled'].includes(order.status) || ['refunded', 'failed'].includes(order.payment_status)) fail('Pedido não permite operação de produção/pagamento.');
}

// A cotação deve vir do catálogo consultado pelo servidor na MESMA transação
// do checkout. Este validador impede divergência com os itens já persistidos.
function buildPrint3dOrderPlan(order, persistedItems, quoteItems, paymentTerms) {
  eligibleOrder(order);
  if (!Array.isArray(quoteItems) || !quoteItems.length || quoteItems.length > 30 || !Array.isArray(persistedItems)
    || persistedItems.length !== quoteItems.length) fail('Itens do pedido divergem da cotação.');
  const byProduct = new Map(persistedItems.map(item => [item.product_id, item]));
  if (byProduct.size !== persistedItems.length) fail('Produtos duplicados no pedido.');
  const seen = new Set();
  const canonicalQuotes = [];
  const items = quoteItems.map(quote => {
    if (!quote || seen.has(quote.product_id)) fail('Produtos duplicados na cotação.');
    seen.add(quote.product_id);
    const persisted = byProduct.get(quote.product_id);
    if (!persisted || persisted.order_id !== order.id || !persisted.id) fail('Item não pertence ao pedido.');
    const quantity = integer(quote.quantity, 1);
    if (quantity > 1000) fail('Quantidade acima do limite do checkout.', 400);
    const ready = integer(quote.ready_quantity);
    const preorder = integer(quote.preorder_quantity);
    if (ready + preorder !== quantity || ready > quantity) fail('Divisão entre estoque e encomenda inválida.');
    if (preorder > 0 && (integer(quote.production_days, 1) > 365)) fail('Prazo de produção inválido.');
    const unitPrice = integer(quote.unit_price, 1);
    const canonical = quoteProduct({ id: quote.product_id, price_retail: unitPrice, available_stock: ready,
      print3d_preorder_enabled: 1, production_days: quote.production_days }, quantity);
    for (const field of ['quantity', 'ready_quantity', 'preorder_quantity', 'unit_price', 'subtotal', 'ready_subtotal',
      'preorder_subtotal', 'deposit_amount', 'balance_before_shipping']) {
      if (integer(quote[field]) !== canonical[field]) fail(`Cotação inconsistente: ${field}.`);
    }
    if (quote.status !== 'available' || canonical.status !== 'available') fail('Item indisponível.');
    if (integer(persisted.quantity) !== quantity || integer(persisted.unit_price) !== unitPrice
      || integer(persisted.subtotal) !== canonical.subtotal) fail('Preço ou quantidade difere do pedido persistido.');
    canonicalQuotes.push(canonical);
    return { order_item_id: persisted.id, order_id: order.id, product_id: persisted.product_id, quantity,
      ...(quote.variant_snapshot === undefined ? {} : { variant_snapshot: JSON.stringify(normalizeVariantSnapshot(quote.variant_snapshot)) }),
      ready_quantity: ready, preorder_quantity: preorder, production_days: canonical.production_days,
      unit_price_cents: unitPrice, subtotal_cents: canonical.subtotal, deposit_amount_cents: canonical.deposit_amount,
      balance_before_shipping_cents: canonical.balance_before_shipping };
  }).sort((a, b) => a.order_item_id.localeCompare(b.order_item_id));
  const schedule = quotePaymentSchedule(canonicalQuotes);
  if (integer(order.subtotal) !== schedule.subtotal || integer(order.discount ?? 0) !== 0
    || integer(order.total) !== schedule.subtotal + integer(order.shipping_cost ?? 0)) fail('Totais do pedido divergem do plano 3D.');
  const terms = buildPaymentTerms(schedule.subtotal,integer(order.shipping_cost ?? 0),paymentTerms);
  const plan = { order_id: order.id, subtotal_cents: schedule.subtotal, ready_amount_cents: schedule.ready_amount,
    preorder_amount_cents: schedule.preorder_amount, deposit_amount_cents: terms.products_initial_cents,
    due_on_confirmation_cents: terms.initial_cents, due_before_shipping_cents: terms.balance_cents,
    payment_terms_version:1,initial_payment_bps:terms.initial_payment_bps,shipping_payment_mode:terms.shipping_payment_mode,
    shipping_initial_cents:terms.shipping_initial_cents,minimum_initial_cents:terms.minimum_initial_cents };
  return { ...plan, plan_hash: digest({ plan, items }), items };
}

async function lockedOrder(connection, orderId) {
  const [rows] = await connection.query('SELECT * FROM orders WHERE id=? LIMIT 1 FOR UPDATE', [orderId]);
  eligibleOrder(rows[0]);
  return rows[0];
}

// Chamador é dono da transação: BEGIN antes, COMMIT/ROLLBACK depois. Não chamar
// via CRUD público nem passar valores monetários fornecidos pelo navegador.
async function savePrint3dOrderPlanOnConnection(connection, { orderId, quoteItems, paymentTerms }) {
  const order = await lockedOrder(connection, orderId);
  const [items] = await connection.query('SELECT * FROM order_items WHERE order_id=? ORDER BY id FOR UPDATE', [orderId]);
  const plan = buildPrint3dOrderPlan(order, items, quoteItems, paymentTerms);
  const [existing] = await connection.query('SELECT * FROM print3d_order_plans WHERE order_id=? LIMIT 1 FOR UPDATE', [orderId]);
  if (existing[0]) {
    if (existing[0].plan_hash !== plan.plan_hash) fail('O plano do pedido é imutável.');
    return { plan, replayed: true };
  }
  const { items: planItems, ...row } = plan;
  await connection.query(`INSERT INTO print3d_order_plans (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`, Object.values(row));
  for (const item of planItems) await connection.query(`INSERT INTO print3d_order_item_plans (${Object.keys(item).join(',')}) VALUES (${Object.keys(item).map(() => '?').join(',')})`, Object.values(item));
  return { plan, replayed: false };
}

async function readPrint3dPaymentCoverageOnConnection(connection, orderId) {
  const order = await lockedOrder(connection, orderId);
  const [plans] = await connection.query('SELECT * FROM print3d_order_plans WHERE order_id=? LIMIT 1 FOR UPDATE', [orderId]);
  if (!plans[0]) fail('Pedido sem plano financeiro 3D.');
  const plan = plans[0];
  if (integer(plan.ready_amount_cents) + integer(plan.preorder_amount_cents) !== integer(plan.subtotal_cents)) fail('Plano financeiro inconsistente.');
  if (integer(plan.subtotal_cents) !== integer(order.subtotal) || integer(order.discount ?? 0) !== 0
    || integer(order.total) !== integer(plan.subtotal_cents) + integer(order.shipping_cost ?? 0)) fail('Plano financeiro diverge do pedido.');
  const version = integer(plan.payment_terms_version ?? 0);
  if (version === 1) {
    const terms = buildPaymentTerms(integer(plan.subtotal_cents),integer(order.shipping_cost ?? 0),{
      initial_payment_bps:integer(plan.initial_payment_bps),shipping_payment_mode:plan.shipping_payment_mode });
    if (integer(plan.deposit_amount_cents) !== terms.products_initial_cents
      || integer(plan.due_on_confirmation_cents,1) !== terms.initial_cents
      || integer(plan.due_before_shipping_cents) !== terms.balance_cents
      || integer(plan.shipping_initial_cents) !== terms.shipping_initial_cents
      || integer(plan.minimum_initial_cents) !== terms.minimum_initial_cents) fail('Condição de pagamento do pedido inconsistente.');
  } else if (version === 0) {
    // Snapshot legado: estoque pronto integral + 50% da parte encomendada.
    // O histórico não é reinterpretado quando as regras de novos pedidos mudam.
    if (integer(plan.deposit_amount_cents) + integer(plan.due_before_shipping_cents) !== integer(plan.preorder_amount_cents)
      || integer(plan.due_on_confirmation_cents,1) !== integer(plan.ready_amount_cents) + integer(plan.deposit_amount_cents)) fail('Plano financeiro legado inconsistente.');
  } else fail('Versão do plano financeiro não suportada.');
  const [receipts] = await connection.query("SELECT COALESCE(SUM(amount_cents),0) AS confirmed_cents FROM print3d_order_payment_receipts WHERE order_id=? AND status='confirmed'", [orderId]);
  const confirmed = integer(receipts[0]?.confirmed_cents ?? 0);
  const required = integer(plan.due_on_confirmation_cents);
  return { order_id: orderId, confirmed_cents: confirmed, due_on_confirmation_cents: required,
    missing_initial_cents: Math.max(0, required - confirmed), initial_payment_covered: confirmed >= required,
    outstanding_cents: Math.max(0, integer(order.total) - confirmed), fully_paid: confirmed >= integer(order.total) };
}

// FUNÇÃO INTERNA, ainda sem gateway/rota chamadora. O futuro adaptador deve
// verificar assinatura, conta recebedora, moeda BRL, status de liquidação e
// vínculo imutável payment->order ANTES de chamar. Nunca aceitar prova do cliente.
// Não altera orders.payment_status nem declara pagamento integral na entrada.
async function recordVerifiedPrint3dPaymentOnConnection(connection, input) {
  const { orderId, eventKey, provider, providerPaymentId } = input;
  const validKey = value => typeof value === 'string' && /^[A-Za-z0-9_.:/-]{1,191}$/.test(value);
  if (!validKey(eventKey) || !validKey(providerPaymentId) || !validKey(provider) || provider.length > 64) fail('Identificação do pagamento inválida.', 400);
  const amount = integer(input.amountCents, 1);
  const date = new Date(input.confirmedAt);
  if (typeof input.confirmedAt !== 'string' || !/Z$/.test(input.confirmedAt) || !Number.isFinite(date.valueOf())) fail('Confirmação exige data UTC válida.', 400);
  const confirmedAt = date.toISOString();
  const coverage = await readPrint3dPaymentCoverageOnConnection(connection, orderId);
  const hash = digest({ orderId, provider, providerPaymentId, amount, confirmedAt });
  const [existing] = await connection.query(`SELECT * FROM print3d_order_payment_receipts
    WHERE provider=? AND (event_key=? OR provider_payment_id=?) FOR UPDATE`, [provider, eventKey, providerPaymentId]);
  if (existing.length) {
    if (existing.length !== 1 || existing[0].payload_hash !== hash) fail('Identificador de pagamento já usado com dados diferentes.');
    return { receipt_id: existing[0].id, replayed: true, coverage };
  }
  if (amount > coverage.outstanding_cents) fail('Confirmação supera o saldo do pedido.');
  const id = crypto.randomUUID();
  await connection.query(`INSERT INTO print3d_order_payment_receipts
    (id,order_id,event_key,provider,provider_payment_id,amount_cents,status,confirmed_at,payload_hash)
    VALUES (?,?,?,?,?,?,'confirmed',?,?)`, [id, orderId, eventKey, provider, providerPaymentId, amount,
    confirmedAt.slice(0, 19).replace('T', ' '), hash]);
  return { receipt_id: id, replayed: false, coverage: await readPrint3dPaymentCoverageOnConnection(connection, orderId) };
}

module.exports = { buildPrint3dOrderPlan, savePrint3dOrderPlanOnConnection,
  recordVerifiedPrint3dPaymentOnConnection, readPrint3dPaymentCoverageOnConnection };
