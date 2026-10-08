'use strict';

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}
function quantity(value) {
  const result = Number(value || 0);
  if (!Number.isSafeInteger(result) || result < 0) fail(409, 'Quantidade inválida no histórico de estoque.');
  return result;
}
const locationKey = row => JSON.stringify([row.product_id, row.from_deposit_id, row.from_location_id]);

// Um único escritor para venda e pedido: a transação inclui saldos, movimentos e totais.
async function restoreStockMovements(pool, { referenceType, restoreReferenceType, referenceId, reason, notes }, helpers) {
  if (!['sale', 'order'].includes(referenceType)
    || restoreReferenceType !== referenceType + '_restore'
    || typeof referenceId !== 'string' || !referenceId.trim()) fail(400, 'Informe a venda ou pedido para devolver o estoque.');
  const db = await pool.getConnection();
  try {
    await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await db.beginTransaction();
    const table = referenceType === 'sale' ? 'sales' : 'orders';
    const [[reference]] = await db.query(`SELECT id FROM ${table} WHERE id=? FOR UPDATE`, [referenceId]);
    if (!reference) fail(404, 'Venda ou pedido não encontrado.');
    const [movements] = await db.query(
      `SELECT * FROM stock_location_movements WHERE reference_type=? AND reference_id=? AND movement_type='sale'
       ORDER BY created_at ASC, id ASC`, [referenceType, referenceId]);
    const products = new Map();
    for (const productId of [...new Set(movements.map(row => row.product_id))].sort()) {
      const [[product]] = await db.query('SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE', [productId]);
      if (!product) fail(409, 'Produto do histórico de estoque não encontrado.');
      products.set(productId, product);
    }
    const [restored] = await db.query(
      `SELECT product_id,to_deposit_id,to_location_id,quantity FROM stock_location_movements
       WHERE reference_type=? AND reference_id=? AND movement_type='cancel'`, [restoreReferenceType, referenceId]);
    const expected = new Map(), remainingRestored = new Map();
    for (const row of movements) {
      if (!row.from_deposit_id || !row.from_location_id) fail(409, 'Local de origem indisponível no histórico.');
      const key = locationKey(row);
      expected.set(key, quantity((expected.get(key) || 0) + quantity(row.quantity)));
    }
    for (const row of restored) {
      const key = locationKey({ ...row, from_deposit_id: row.to_deposit_id, from_location_id: row.to_location_id });
      remainingRestored.set(key, quantity((remainingRestored.get(key) || 0) + quantity(row.quantity)));
    }
    for (const [key, amount] of remainingRestored) {
      if (amount > (expected.get(key) || 0)) fail(409, 'Devolução anterior incompatível com a baixa. Confira o histórico.');
    }
    const result = [], changedProducts = new Set();
    for (const movement of movements) {
      const key = locationKey(movement), amount = quantity(movement.quantity);
      const alreadyRestored = Math.min(amount, remainingRestored.get(key) || 0);
      remainingRestored.set(key, (remainingRestored.get(key) || 0) - alreadyRestored);
      const delta = amount - alreadyRestored;
      if (!delta) continue;
      const current = await helpers.getStockLocationRow(movement.product_id, movement.from_deposit_id, movement.from_location_id, true, db);
      const previous = quantity(current?.quantity);
      const next = quantity(previous + delta);
      if (next > 2147483647) fail(409, 'Saldo excede o limite de estoque.');
      const companyId = movement.company_id || current?.company_id || products.get(movement.product_id).company_id
        || await helpers.getDefaultStockCompanyId();
      if (!companyId) fail(409, 'Empresa do estoque não configurada.');
      await helpers.upsertStockLocationBalance({
        db, companyId, productId: movement.product_id, depositId: movement.from_deposit_id,
        locationId: movement.from_location_id, quantity: next, reservedQuantity: quantity(current?.reserved_quantity),
      });
      await helpers.insertStockMovement({
        company_id: companyId, product_id: movement.product_id,
        to_deposit_id: movement.from_deposit_id, to_location_id: movement.from_location_id,
        quantity: delta, movement_type: 'cancel', reason, reference_type: restoreReferenceType, reference_id: referenceId,
        previous_to_quantity: previous, new_to_quantity: next, notes,
      }, db);
      changedProducts.add(movement.product_id);
      result.push({ [referenceType + '_movement_id']: movement.id, product_id: movement.product_id,
        deposit_id: movement.from_deposit_id, location_id: movement.from_location_id,
        quantity_restored: delta, previous_quantity: previous, new_quantity: next });
    }
    for (const productId of changedProducts) await helpers.syncProductStockFromLocations(productId, db);
    await db.commit();
    return result;
  } catch (error) {
    try { await db.rollback(); } catch {}
    throw error;
  } finally {
    db.release();
  }
}
module.exports = { restoreStockMovements };
