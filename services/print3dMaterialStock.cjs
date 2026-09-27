'use strict';

const { randomUUID } = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILAMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const gramsToMillis = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000000 && Number.isInteger(value * 1000) ? value * 1000 : null;

async function listPrint3dFilamentStock(pool) {
  const [rows] = await pool.query('SELECT filament_id,name_snapshot,color_snapshot,quantity_grams,updated_at FROM print3d_filament_stock ORDER BY name_snapshot,color_snapshot,filament_id');
  return rows.map(row => ({ ...row, quantity_grams: Number(row.quantity_grams) }));
}

async function receivePrint3dFilament(pool, { body, actorId }) {
  const filamentId = String(body?.filament_id || '');
  const key = String(body?.idempotency_key || '').toLowerCase();
  const millis = gramsToMillis(body?.quantity_grams);
  if (!FILAMENT_ID.test(filamentId) || !UUID.test(key) || millis === null || !actorId) fail(400, 'Informe filamento, quantidade em gramas e identificador do lançamento válidos.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [preferences] = await connection.query("SELECT value_json FROM admin_preferences WHERE preference_key='print3d.cost.v1' LIMIT 1");
    const value = preferences[0]?.value_json;
    const settings = typeof value === 'string' ? JSON.parse(value) : value;
    const filament = settings?.filaments?.find(item => item?.id === filamentId);
    if (!filament?.name?.trim() || !filament?.color?.trim()) fail(409, 'Cadastre este filamento e sua cor na calculadora antes da entrada física.');
    // Create the zero-balance row first so two first receipts for the same
    // filament serialize on the primary key rather than racing on a missing row.
    await connection.query('INSERT INTO print3d_filament_stock (filament_id,name_snapshot,color_snapshot,quantity_grams) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE filament_id=filament_id',
      [filamentId,filament.name.trim(),filament.color.trim()]);
    const [stockRows] = await connection.query('SELECT * FROM print3d_filament_stock WHERE filament_id=? FOR UPDATE', [filamentId]);
    const [previous] = await connection.query('SELECT id,filament_id,quantity_delta_grams,reason FROM print3d_filament_movements WHERE movement_key=? FOR UPDATE', [key]);
    if (previous[0]) {
      if (previous[0].filament_id !== filamentId || previous[0].reason !== 'receipt' || Math.round(Number(previous[0].quantity_delta_grams) * 1000) !== millis) fail(409, 'Este lançamento já foi usado com outros dados.');
      await connection.commit();
      return { filament_id: filamentId, quantity_grams: Number(stockRows[0].quantity_grams), replayed: true };
    }
    await connection.query('UPDATE print3d_filament_stock SET quantity_grams=quantity_grams+?,name_snapshot=?,color_snapshot=? WHERE filament_id=?',
      [millis / 1000,filament.name.trim(),filament.color.trim(),filamentId]);
    await connection.query('INSERT INTO print3d_filament_movements (id,filament_id,movement_key,quantity_delta_grams,reason,actor_id) VALUES (?,?,?,?,?,?)',
      [randomUUID(),filamentId,key,millis / 1000,'receipt',String(actorId)]);
    await connection.commit();
    return { filament_id: filamentId, quantity_grams: Number(stockRows[0]?.quantity_grams || 0) + millis / 1000, replayed: false };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function consumePrint3dFilamentsOnConnection(connection, { allocations, productionEventId, actorId }) {
  for (const item of [...allocations].sort((left, right) => left.filament_id.localeCompare(right.filament_id, 'en'))) {
    const [rows] = await connection.query('SELECT quantity_grams FROM print3d_filament_stock WHERE filament_id=? FOR UPDATE', [item.filament_id]);
    const balance = Number(rows[0]?.quantity_grams);
    if (!Number.isFinite(balance) || balance * 1000 < item.grams_millis) fail(409, 'Saldo físico insuficiente para o filamento ' + item.filament_id + '.');
    const grams = item.grams_millis / 1000;
    const [updated] = await connection.query('UPDATE print3d_filament_stock SET quantity_grams=quantity_grams-? WHERE filament_id=? AND quantity_grams>=?',
      [grams,item.filament_id,grams]);
    if (Number(updated.affectedRows) !== 1) fail(409, 'Saldo físico do filamento mudou. Atualize e tente novamente.');
    await connection.query('INSERT INTO print3d_filament_movements (id,filament_id,movement_key,production_event_id,quantity_delta_grams,reason,actor_id) VALUES (?,?,?,?,?,?,?)',
      [randomUUID(),item.filament_id,randomUUID(),productionEventId,-grams,'production',String(actorId)]);
  }
}

module.exports = { FILAMENT_ID, gramsToMillis, listPrint3dFilamentStock, receivePrint3dFilament, consumePrint3dFilamentsOnConnection };
