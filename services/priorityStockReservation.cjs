'use strict';

const crypto = require('node:crypto');

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

async function reservePriorityStockOnConnection(connection, input) {
  const quantity = positiveInteger(input?.quantity);
  const productId = String(input?.product_id || '');
  if (!productId || !quantity) return { status: 400, error: 'Produto e quantidade inteira positiva sao obrigatorios.' };
  // A transacao pertence ao chamador: pedidos e reserva devem confirmar juntos.
    // Todos os checkouts deste produto usam a mesma trava antes de ler os saldos.
    const [[product]] = await connection.query('SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE', [productId]);
    if (!product) {
      return { status: 404, error: 'Produto nao encontrado.' };
    }
    const [sources] = await connection.query(
      `SELECT psl.*,
              sd.name AS deposit_name, sd.code AS deposit_code, sd.type AS deposit_type, sd.is_default AS deposit_is_default,
              sl.name AS location_name, sl.code AS location_code, sl.is_default AS location_is_default
         FROM product_stock_locations psl
         LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
         LEFT JOIN stock_locations sl ON sl.id = psl.location_id
        WHERE psl.product_id = ? AND (psl.quantity - psl.reserved_quantity) > 0
        ORDER BY sd.is_default DESC, sl.is_default DESC, psl.quantity DESC, psl.id
        FOR UPDATE`, [productId]
    );
    const totalAvailable = sources.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) - Number(row.reserved_quantity)), 0);
    if (totalAvailable < quantity) {
      return { status: 400, error: 'insufficient_stock_by_location' };
    }
    let remaining = quantity;
    const result = [];
    for (const source of sources) {
      if (remaining <= 0) break;
      const previous = Number(source.quantity);
      const previousReserved = Number(source.reserved_quantity);
      const reserve = Math.min(remaining, previous - previousReserved);
      if (reserve <= 0) continue;
      const [updated] = await connection.query(
        `UPDATE product_stock_locations
            SET reserved_quantity = reserved_quantity + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (quantity - reserved_quantity) >= ?`,
        [reserve, source.id, reserve]
      );
      if (updated.affectedRows !== 1) throw new Error('stock_reservation_conflict');
      await connection.query(
        `INSERT INTO stock_location_movements
          (id, company_id, product_id, from_deposit_id, from_location_id, quantity,
           movement_type, reason, reference_type, reference_id,
           previous_from_quantity, new_from_quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'reservation', ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), source.company_id || product.company_id, productId,
          source.deposit_id, source.location_id, reserve,
          String(input.reason || '').trim() || 'Reserva por prioridade',
          input.reference_type || 'order_reservation', input.reference_id || null,
          previous, previous, input.notes || null]
      );
      result.push({ stock_location_id: source.id, deposit_id: source.deposit_id,
        location_id: source.location_id, quantity_reserved: reserve,
        previous_reserved_quantity: previousReserved, new_reserved_quantity: previousReserved + reserve });
      remaining -= reserve;
    }
    return { status: 200, reservations: result };
}

async function reservePriorityStock(pool, input) {
  const quantity = positiveInteger(input?.quantity);
  const productId = String(input?.product_id || '');
  if (!productId || !quantity) return { status: 400, error: 'Produto e quantidade inteira positiva sao obrigatorios.' };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const outcome = await reservePriorityStockOnConnection(connection, input);
    if (outcome.status !== 200) {
      await connection.rollback();
      return outcome;
    }
    await connection.commit();
    return outcome;
  } catch (error) {
    try { await connection.rollback(); } catch { /* Preserve the original error. */ }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { reservePriorityStock, reservePriorityStockOnConnection };
