'use strict';
const { ensureUnitStatusSchema } = require('./unitStatusSchema.cjs');

function validateUnitVisibility(unit, action, reason) {
  const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
  if (!['hide', 'restore'].includes(action)) fail(400, 'Ação de visibilidade inválida.');
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    fail(400, 'Informe um motivo entre 3 e 500 caracteres.');
  }
  if (!unit) fail(404, 'Unidade não encontrada.');
  const expected = action === 'hide' ? 'available' : 'hidden';
  const next = action === 'hide' ? 'hidden' : 'available';
  if (unit.status !== expected || unit.order_id || unit.sale_id) {
    fail(409, action === 'hide' ? 'Somente uma unidade disponível e sem pedido pode ser ocultada.' : 'Somente uma unidade oculta e sem pedido pode ser reativada.');
  }
  const note = `[${new Date().toISOString()}] ${action === 'hide' ? 'Ocultada' : 'Reativada'}: ${reason.trim()}`;
  return { expected, next, note };
}

async function setUnitVisibility({ pool, syncProductStock, id, action, reason }) {
  const [rows] = await pool.query('SELECT * FROM units WHERE id = ?', [id]);
  const unit = rows[0];
  const { expected, next, note } = validateUnitVisibility(unit, action, reason);
  await ensureUnitStatusSchema(pool);
  const [result] = await pool.query(
    "UPDATE units SET status = ?, internal_notes = CONCAT_WS('\n', NULLIF(internal_notes, ''), ?) WHERE id = ? AND status = ? AND order_id IS NULL AND sale_id IS NULL",
    [next, note, id, expected],
  );
  if (result.affectedRows !== 1) throw Object.assign(new Error('A situação desta unidade mudou. Atualize a lista antes de tentar novamente.'), { statusCode: 409 });
  await syncProductStock(unit.product_id);
  const [updated] = await pool.query('SELECT * FROM units WHERE id = ?', [id]);
  return updated[0];
}

module.exports = { setUnitVisibility, validateUnitVisibility };
