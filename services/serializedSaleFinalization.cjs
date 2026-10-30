'use strict';
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const movingCosts = require('./smartphoneMovingAverageServer.cjs');
const SALE_FIELDS = 'id customer_id seller_id total discount subtotal discount_total cost_total profit payment_method payment_methods payment_status notes delivery_type delivery_person_id delivery_person_customer_id delivery_cost_store delivery_cost_customer delivery_total promotional_discount coupon_code coupon_id final_adjustment_discount referral_code finalization_status finalization_log finalization_error_summary cash_session_id refund_cash_session_id'.split(' ');
const ITEM_FIELDS = 'sale_id product_id product_name product_sku quantity unit_price unit_cost discount subtotal total warranty_months imei serialized_unit_id'.split(' ');
function fail(message, statusCode = 409) { throw Object.assign(new Error(message), { statusCode }); }
function project(row, fields) { return Object.fromEntries(fields.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key] ?? null])); }
const NUMERIC_FIELDS = new Set('total discount subtotal discount_total cost_total profit delivery_cost_store delivery_cost_customer delivery_total promotional_discount final_adjustment_discount quantity unit_price unit_cost warranty_months'.split(' '));
const JSON_FIELDS = new Set(['payment_methods','finalization_log']);
function sameValue(a, b, key) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (NUMERIC_FIELDS.has(key)) return Number.isFinite(Number(a)) && Number(a) === Number(b);
  if (JSON_FIELDS.has(key)) {
    try { return isDeepStrictEqual(typeof a === 'string' ? JSON.parse(a) : a, typeof b === 'string' ? JSON.parse(b) : b); }
    catch { return false; }
  }
  if (typeof a === 'object') a = JSON.stringify(a);
  if (typeof b === 'object') b = JSON.stringify(b);
  return String(a) === String(b);
}
async function insert(db, table, row) {
  const keys = Object.keys(row);
  await db.query(`INSERT INTO ${table} (${keys.map(key => '`' + key + '`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(row).map(value => value && typeof value === 'object' ? JSON.stringify(value) : value));
}
async function finalizeSerializedSaleOnce({ pool, sale: inputSale, items: inputItems, syncProductStock }) {
  if (!inputSale?.id || !Array.isArray(inputItems) || !inputItems.length || inputItems.length > 200) fail('Venda e itens obrigatorios.', 400);
  const sale = project(inputSale, SALE_FIELDS);
  const items = inputItems.map(item => project(item, ITEM_FIELDS));
  const selected = items.filter(item => item.serialized_unit_id);
  if (!selected.length) fail('Selecione uma unidade serializada.', 400);
  if (new Set(selected.map(item => item.serialized_unit_id)).size !== selected.length) fail('Uma unidade foi selecionada mais de uma vez.', 400);
  if (items.some(item => item.sale_id !== sale.id || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0)
    || selected.some(item => !item.product_id || Number(item.quantity) !== 1)) fail('Item ou quantidade serializada invalida.', 400);
  if (sale.payment_status !== 'paid') fail('Estado de pagamento invalido.', 400);
  const db = await pool.getConnection();
  let valuation;
  try {
    await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await db.beginTransaction();
    // Ordem estavel de travas: venda, modelos/saldos de custo, produtos e unidades.
    const [existing] = await db.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [sale.id]);
    if (existing.length) {
      const basis = await movingCosts.saleBasis(db, sale.id);
      const averagedUnits = new Set(basis.map(row => row.unit_id));
      const [savedItems] = await db.query('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [sale.id]);
      const unmatched = [...savedItems];
      const matches = items.every(item => {
        const index = unmatched.findIndex(saved => Object.entries(item).every(([key, value]) =>
          key === 'unit_cost' && averagedUnits.has(item.serialized_unit_id) || sameValue(saved[key], value, key)));
        if (index < 0) return false;
        unmatched.splice(index, 1); return true;
      });
      if (!matches || unmatched.length || !Object.entries(sale).every(([key, value]) =>
        basis.length && ['cost_total', 'profit'].includes(key) || sameValue(existing[0][key], value, key))) fail('Esta venda ja existe com outros dados.');
      const [units] = await db.query('SELECT id, status, sale_id FROM units WHERE sale_id = ? ORDER BY id FOR UPDATE', [sale.id]);
      if (units.length !== selected.length || selected.some(item => !units.some(unit => unit.id === item.serialized_unit_id && unit.status === 'sold'))) fail('Venda existente exige conferencia de estoque.');
      await db.commit(); return { sale: existing[0], replay: true };
    }
    if (sale.cash_session_id) {
      const [cashRows] = await db.query('SELECT status, opened_at FROM pdv_cash_sessions WHERE id = ? LIMIT 1 FOR UPDATE', [sale.cash_session_id]);
      if (!cashRows.length || cashRows[0].status !== 'open') fail('Caixa fechado ou nao encontrado. Abra um caixa para continuar.');
      if (require('./cashSessionCutoff.cjs').cashSessionCutoff(cashRows[0].opened_at).requires_closing) {
        fail('Caixa bloqueado desde as 20h. Faca o fechamento e abra um novo caixa para continuar.');
      }
    }
    const productIds = [...new Set(selected.map(item => item.product_id))].sort();
    valuation = await movingCosts.prepareSale(db, sale, items);
    const productsById = new Map();
    for (const productId of productIds) {
      const [products] = await db.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (!products.length) fail('Produto da unidade nao encontrado.');
      productsById.set(productId, products[0]);
    }
    let controlledCosts = false;
    for (const item of [...selected].sort((a, b) => String(a.serialized_unit_id).localeCompare(String(b.serialized_unit_id)))) {
      const [units] = await db.query('SELECT * FROM units WHERE id = ? FOR UPDATE', [item.serialized_unit_id]);
      const unit = units[0];
      if (!unit || unit.product_id !== item.product_id || unit.status !== 'available' || unit.sale_id || unit.order_id) fail('A unidade selecionada nao esta mais disponivel. Atualize a busca e selecione outro aparelho.');
      controlledCosts = valuation.apply(productsById.get(item.product_id), unit, item) || controlledCosts;
    }
    if (controlledCosts) {
      const money = value => {
        const amount = Number(value ?? 0);
        if (!Number.isSafeInteger(amount) || amount < 0) fail('Valor monetário inválido.', 400);
        return amount;
      };
      sale.cost_total = items.reduce((total, item) => total + money(item.unit_cost) * Number(item.quantity), 0);
      const payments = typeof sale.payment_methods === 'string' ? JSON.parse(sale.payment_methods) : sale.payment_methods || [];
      const fees = payments.reduce((total, payment) => total + money(payment.operator_fee_amount), 0);
      sale.profit = money(sale.total) - sale.cost_total - fees - money(sale.delivery_total);
    }
    await insert(db, 'sales', sale);
    for (const item of items) await insert(db, 'sale_items', { id: randomUUID(), ...item });
    for (const item of selected) {
      const [result] = await db.query("UPDATE units SET status = 'sold', sale_id = ?, order_id = NULL, sold_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'available' AND sale_id IS NULL AND order_id IS NULL", [sale.id, item.serialized_unit_id]);
      if (result.affectedRows !== 1) fail('A disponibilidade da unidade mudou durante a venda.');
    }
    for (const productId of productIds) await syncProductStock(productId, db);
    await valuation.persist();
    const [saved] = await db.query('SELECT * FROM sales WHERE id = ?', [sale.id]);
    await db.commit();
    return { sale: saved[0], replay: false };
  } catch (error) { await db.rollback(); throw error; }
  finally { valuation?.release(); db.release(); }
}
async function finalizeSerializedSale(input) {
  for (let attempt = 0; ; attempt++) {
    try { return await finalizeSerializedSaleOnce(input); }
    catch (error) {
      if (attempt >= 2 || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw error;
      // No notification/payment side effect happens before this transaction commits.
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}
module.exports = { finalizeSerializedSale };
