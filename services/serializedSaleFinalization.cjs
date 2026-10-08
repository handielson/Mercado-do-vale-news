'use strict';
const { randomUUID } = require('node:crypto');
const SALE_FIELDS = 'id customer_id seller_id total discount subtotal discount_total cost_total profit payment_method payment_methods payment_status notes delivery_type delivery_person_id delivery_person_customer_id delivery_cost_store delivery_cost_customer delivery_total promotional_discount coupon_code coupon_id final_adjustment_discount referral_code finalization_status finalization_log finalization_error_summary cash_session_id refund_cash_session_id'.split(' ');
const ITEM_FIELDS = 'sale_id product_id product_name product_sku quantity unit_price unit_cost discount subtotal total warranty_months imei serialized_unit_id'.split(' ');
function fail(message, statusCode = 409) { throw Object.assign(new Error(message), { statusCode }); }
function project(row, fields) { return Object.fromEntries(fields.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key] ?? null])); }
function sameValue(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === 'object') a = JSON.stringify(a);
  if (typeof b === 'object') b = JSON.stringify(b);
  return String(a) === String(b);
}
async function insert(db, table, row) {
  const keys = Object.keys(row);
  await db.query(`INSERT INTO ${table} (${keys.map(key => '`' + key + '`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(row).map(value => value && typeof value === 'object' ? JSON.stringify(value) : value));
}
async function finalizeSerializedSale({ pool, sale: inputSale, items: inputItems, syncProductStock }) {
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
  try {
    await db.beginTransaction();
    // Ordem estavel de travas: venda, produtos e unidades.
    const [existing] = await db.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [sale.id]);
    if (existing.length) {
      const [savedItems] = await db.query('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [sale.id]);
      const unmatched = [...savedItems];
      const matches = items.every(item => {
        const index = unmatched.findIndex(saved => Object.entries(item).every(([key, value]) => sameValue(saved[key], value)));
        if (index < 0) return false;
        unmatched.splice(index, 1); return true;
      });
      if (!matches || unmatched.length || !Object.entries(sale).every(([key, value]) => sameValue(existing[0][key], value))) fail('Esta venda ja existe com outros dados.');
      const [units] = await db.query('SELECT id, status, sale_id FROM units WHERE sale_id = ? ORDER BY id FOR UPDATE', [sale.id]);
      if (units.length !== selected.length || selected.some(item => !units.some(unit => unit.id === item.serialized_unit_id && unit.status === 'sold'))) fail('Venda existente exige conferencia de estoque.');
      await db.commit(); return { sale: existing[0], replay: true };
    }
    const productIds = [...new Set(selected.map(item => item.product_id))].sort();
    for (const productId of productIds) {
      const [products] = await db.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (!products.length) fail('Produto da unidade nao encontrado.');
    }
    for (const item of [...selected].sort((a, b) => String(a.serialized_unit_id).localeCompare(String(b.serialized_unit_id)))) {
      const [units] = await db.query('SELECT * FROM units WHERE id = ? FOR UPDATE', [item.serialized_unit_id]);
      const unit = units[0];
      if (!unit || unit.product_id !== item.product_id || unit.status !== 'available' || unit.sale_id || unit.order_id) fail('A unidade selecionada nao esta mais disponivel. Atualize a busca e selecione outro aparelho.');
    }
    await insert(db, 'sales', sale);
    for (const item of items) await insert(db, 'sale_items', { id: randomUUID(), ...item });
    for (const item of selected) {
      const [result] = await db.query("UPDATE units SET status = 'sold', sale_id = ?, order_id = NULL, sold_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'available' AND sale_id IS NULL AND order_id IS NULL", [sale.id, item.serialized_unit_id]);
      if (result.affectedRows !== 1) fail('A disponibilidade da unidade mudou durante a venda.');
    }
    for (const productId of productIds) await syncProductStock(productId, db);
    const [saved] = await db.query('SELECT * FROM sales WHERE id = ?', [sale.id]);
    await db.commit();
    return { sale: saved[0], replay: false };
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}
module.exports = { finalizeSerializedSale };
