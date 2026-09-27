'use strict';

const { randomUUID } = require('node:crypto');
const { FILAMENT_ID } = require('./print3dMaterialStock.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const unitsToMicros = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) return null;
  const micros = Math.round(value * 1000000);
  return Math.abs(value * 1000000 - micros) < 0.00001 ? micros : null;
};
function catalogSupply(settings,id) {
  if (id === 'packaging-per-piece' && Number(settings?.packagingCentsPerPiece) > 0) {
    return {id,name:'Embalagem por peça',unitLabel:'un'};
  }
  return settings?.supplies?.find(item => item?.id === id);
}
function unitLabel(value) {
  const label = String(value || 'un').trim();
  if (!label || label.length > 40 || /[\x00-\x1f]/.test(label)) fail(409,'Unidade do insumo inválida.');
  return label;
}
async function listPrint3dSupplyStock(pool) {
  const [rows] = await pool.query('SELECT supply_id,name_snapshot,unit_snapshot,quantity_units,updated_at FROM print3d_supply_stock ORDER BY name_snapshot,supply_id');
  return rows.map(row => ({...row,quantity_units:Number(row.quantity_units)}));
}
async function receivePrint3dSupply(pool,{body,actorId}) {
  const id = String(body?.supply_id || '');
  const key = String(body?.idempotency_key || '').toLowerCase();
  const micros = unitsToMicros(body?.quantity_units);
  if (!FILAMENT_ID.test(id) || !UUID.test(key) || micros === null || micros === 0 || !actorId) {
    fail(400,'Informe insumo, quantidade positiva e identificador do lançamento válidos.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [preferences] = await connection.query("SELECT value_json FROM admin_preferences WHERE preference_key='print3d.cost.v1' LIMIT 1");
    const raw = preferences[0]?.value_json;
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const supply = catalogSupply(settings,id);
    if (!supply?.name?.trim()) fail(409,'Cadastre este insumo na calculadora antes da entrada física.');
    const label = unitLabel(supply.unitLabel);
    await connection.query(`INSERT INTO print3d_supply_stock (supply_id,name_snapshot,unit_snapshot,quantity_units)
      VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE supply_id=supply_id`,[id,supply.name.trim(),label]);
    const [stocks] = await connection.query('SELECT * FROM print3d_supply_stock WHERE supply_id=? FOR UPDATE',[id]);
    if (stocks[0].unit_snapshot !== label && Number(stocks[0].quantity_units) !== 0) fail(409,'A unidade deste insumo mudou. Ajuste o saldo antes de receber novamente.');
    const [previous] = await connection.query('SELECT supply_id,quantity_delta_units,reason FROM print3d_supply_movements WHERE movement_key=? FOR UPDATE',[key]);
    if (previous[0]) {
      if (previous[0].supply_id !== id || previous[0].reason !== 'receipt' || Math.round(Number(previous[0].quantity_delta_units)*1000000) !== micros) {
        fail(409,'Este lançamento já foi usado com outros dados.');
      }
      await connection.commit();
      return {supply_id:id,quantity_units:Number(stocks[0].quantity_units),replayed:true};
    }
    await connection.query('UPDATE print3d_supply_stock SET quantity_units=quantity_units+?,name_snapshot=?,unit_snapshot=? WHERE supply_id=?',
      [micros/1000000,supply.name.trim(),label,id]);
    await connection.query(`INSERT INTO print3d_supply_movements
      (id,supply_id,movement_key,quantity_delta_units,reason,actor_id) VALUES (?,?,?,?,?,?)`,
      [randomUUID(),id,key,micros/1000000,'receipt',String(actorId)]);
    await connection.commit();
    return {supply_id:id,quantity_units:Number(stocks[0].quantity_units)+micros/1000000,replayed:false};
  } catch (error) { try { await connection.rollback(); } catch {} throw error; }
  finally { connection.release(); }
}
async function consumePrint3dSuppliesOnConnection(connection,{allocations,productionEventId,actorId,recipeSupplies}) {
  const expected = new Map(recipeSupplies.map(item => [item.id,item]));
  if (expected.size !== recipeSupplies.length || allocations.length !== expected.size) fail(409,'Insumos da ficha inconsistentes.');
  for (const item of [...allocations].sort((a,b) => a.supply_id.localeCompare(b.supply_id,'en'))) {
    const recipe = expected.get(item.supply_id);
    if (!recipe || !FILAMENT_ID.test(item.supply_id) || !Number.isSafeInteger(item.quantity_micros) || item.quantity_micros < 0) {
      fail(409,'Informe o consumo real dos insumos da ficha.');
    }
    if (!item.quantity_micros) continue;
    const [rows] = await connection.query('SELECT quantity_units,unit_snapshot FROM print3d_supply_stock WHERE supply_id=? FOR UPDATE',[item.supply_id]);
    const available = Math.round(Number(rows[0]?.quantity_units)*1000000);
    if (!Number.isSafeInteger(available) || available < item.quantity_micros || rows[0].unit_snapshot !== recipe.unit_label) {
      fail(409,'Saldo físico insuficiente ou unidade divergente para o insumo '+item.supply_id+'.');
    }
    const units = item.quantity_micros/1000000;
    const [updated] = await connection.query('UPDATE print3d_supply_stock SET quantity_units=quantity_units-? WHERE supply_id=? AND quantity_units>=?',
      [units,item.supply_id,units]);
    if (Number(updated.affectedRows) !== 1) fail(409,'Saldo físico do insumo mudou. Atualize e tente novamente.');
    await connection.query(`INSERT INTO print3d_supply_movements
      (id,supply_id,movement_key,production_event_id,quantity_delta_units,reason,actor_id) VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(),item.supply_id,randomUUID(),productionEventId,-units,'production',String(actorId)]);
  }
}
module.exports = {unitsToMicros,catalogSupply,listPrint3dSupplyStock,receivePrint3dSupply,consumePrint3dSuppliesOnConnection};
