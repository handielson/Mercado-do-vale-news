'use strict';
const crypto = require('crypto');

// Local do aparelho (Parte 2 do spec 2026-11-18-historico-do-aparelho-design.md).
// O saldo por local de produto com IMEI é recalculado a partir dos aparelhos
// (syncSerializedProductStockFromUnits), então aqui só se mexe em units.deposit_id/location_id,
// grava o evento e pede o recálculo.

const UNIT_EVENTS_TABLE = 'unit_events';
const MOVABLE = new Set(['available', 'reserved']);
const STATUS_WORDS = { sold: 'vendido', hidden: 'oculto', rma: 'em RMA', scrapped: 'descartado' };
const MAX_IDENTIFIERS = 100;

const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };

function unitEventsMigration() {
  const t = '`unit_events`';
  return [
    { name: 'table', sql: `CREATE TABLE IF NOT EXISTS ${t} (
      id CHAR(36) NOT NULL PRIMARY KEY,
      unit_id CHAR(36) NOT NULL,
      product_id CHAR(36) NULL,
      event_type VARCHAR(48) NOT NULL,
      occurred_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
      actor_user_id VARCHAR(80) NULL,
      actor_name VARCHAR(200) NULL,
      from_deposit_id CHAR(36) NULL, from_location_id CHAR(36) NULL,
      to_deposit_id CHAR(36) NULL, to_location_id CHAR(36) NULL,
      status_before VARCHAR(32) NULL, status_after VARCHAR(32) NULL,
      reference_type VARCHAR(48) NULL, reference_id VARCHAR(80) NULL,
      reason VARCHAR(500) NULL,
      INDEX \`idx_unit_events_unit\` (\`unit_id\`, \`occurred_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` },
    { name: 'mdv_unit_events_no_update', sql: `CREATE TRIGGER \`mdv_unit_events_no_update\` BEFORE UPDATE ON ${t} FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'unit_events é só inclusão'` },
    { name: 'mdv_unit_events_no_delete', sql: `CREATE TRIGGER \`mdv_unit_events_no_delete\` BEFORE DELETE ON ${t} FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'unit_events é só inclusão'` },
  ];
}

function withIncomingDefault(unit = {}, incoming) {
  if (Boolean(unit.deposit_id) !== Boolean(unit.location_id)) {
    throw Object.assign(new Error('Informe o depósito e o local juntos, ou nenhum dos dois.'), { statusCode: 400, halfLocation: true });
  }
  if (unit.deposit_id && unit.location_id) return { deposit_id: unit.deposit_id, location_id: unit.location_id };
  return { deposit_id: incoming.depositId, location_id: incoming.locationId };
}

function isReturnFromSale(beforeStatus, afterStatus) {
  return String(beforeStatus || '') === 'sold' && String(afterStatus || '') === 'available';
}

async function recordUnitEvent(db, e) {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO \`${UNIT_EVENTS_TABLE}\`
      (id, unit_id, product_id, event_type, actor_user_id, actor_name, from_deposit_id, from_location_id,
       to_deposit_id, to_location_id, status_before, status_after, reference_type, reference_id, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.unitId, e.productId || null, e.eventType, e.actor?.userId || null, e.actor?.name || null,
      e.from?.depositId || null, e.from?.locationId || null, e.to?.depositId || null, e.to?.locationId || null,
      e.statusBefore || null, e.statusAfter || null, e.referenceType || null, e.referenceId || null,
      e.reason ? String(e.reason).slice(0, 500) : null]
  );
  return id;
}

async function transferUnits({ db, identifiers, toDepositId, toLocationId, companyId = null, actor, reason, syncProductStock }) {
  const wanted = [...new Set((Array.isArray(identifiers) ? identifiers : []).map(v => String(v ?? '').trim()).filter(Boolean))];
  if (!wanted.length) fail(400, 'Bipe ou digite pelo menos um IMEI ou serial.');
  if (wanted.length > MAX_IDENTIFIERS) fail(400, `No máximo ${MAX_IDENTIFIERS} aparelhos por transferência.`);
  await db.beginTransaction();
  try {
    // Destino precisa estar ativo (local e depósito) e ser da mesma empresa.
    const [destRows] = await db.query(
      `SELECT l.id, l.deposit_id, l.name FROM stock_locations l JOIN stock_deposits d ON d.id = l.deposit_id
        WHERE l.id = ? AND l.deposit_id = ? AND (? IS NULL OR l.company_id = ?) AND l.is_active = 1 AND d.is_active = 1 LIMIT 1`,
      [toLocationId, toDepositId, companyId, companyId]);
    if (!destRows?.length) fail(404, 'Local de destino não encontrado.');
    // Acha os ids sem travar e depois trava só esses aparelhos, sempre na mesma ordem (evita travar a tabela e deadlock).
    const [found] = await db.query(
      'SELECT id FROM units WHERE imei_1 IN (?) OR imei_2 IN (?) OR imei IN (?) OR serial IN (?) OR id IN (?)',
      Array(5).fill(wanted));
    const ids = [...new Set((found || []).map(r => String(r.id)))].sort();
    const [rows] = ids.length ? await db.query('SELECT * FROM units WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]) : [[]];
    const plan = [];
    const skipped = [];
    for (const identifier of wanted) {
      const matches = (rows || []).filter(u => ['imei_1', 'imei_2', 'imei', 'serial', 'id'].some(k => u[k] != null && String(u[k]) === identifier));
      if (!matches.length) fail(404, `IMEI ou serial não encontrado: ${identifier}.`);
      if (matches.length > 1) fail(409, `${identifier} pertence a mais de um aparelho. Use o outro IMEI ou o serial.`);
      const unit = matches[0];
      if (!MOVABLE.has(String(unit.status))) fail(409, `${identifier} está ${STATUS_WORDS[unit.status] || unit.status} e não pode ser transferido.`);
      if (String(unit.deposit_id || '') === String(toDepositId) && String(unit.location_id || '') === String(toLocationId)) {
        if (!skipped.some(s => s.unitId === unit.id)) skipped.push({ identifier, unitId: unit.id, reason: 'já está nesse local' });
        continue;
      }
      if (!plan.some(p => p.unit.id === unit.id)) plan.push({ unit, identifier });
    }
    const moved = [];
    for (const { unit } of plan) {
      const from = { depositId: unit.deposit_id || null, locationId: unit.location_id || null };
      const [result] = await db.query('UPDATE units SET deposit_id = ?, location_id = ? WHERE id = ?', [toDepositId, toLocationId, unit.id]);
      if (result?.affectedRows !== 1) fail(409, 'Um aparelho mudou durante a transferência. Tente de novo.');
      const to = { depositId: toDepositId, locationId: toLocationId };
      await recordUnitEvent(db, { unitId: unit.id, productId: unit.product_id, eventType: 'transfer', actor, from, to,
        statusBefore: unit.status, statusAfter: unit.status, reason: reason || 'Transferência de aparelho' });
      moved.push({ unitId: unit.id, productId: unit.product_id, from, to });
    }
    for (const productId of [...new Set(moved.map(m => m.productId))]) {
      await syncProductStock(productId, db, { stockLocationInTransaction: true });
    }
    await db.commit();
    return { moved, skipped };
  } catch (error) {
    await db.rollback();
    throw lockConflict(error);
  }
}

// Concorrência com venda/outra transferência: o operador só precisa tentar de novo.
function lockConflict(error) {
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error?.code)) {
    return Object.assign(new Error('Outro movimento estava mexendo nesses aparelhos. Tente de novo.'), { statusCode: 409 });
  }
  return error;
}

async function stockMismatches(db) {
  const [rows] = await db.query(
    `SELECT u.product_id, p.sku, p.name, u.n AS units, COALESCE(s.q, 0) AS balance
       FROM (SELECT product_id, SUM(status IN ('available','reserved')) AS n FROM units GROUP BY product_id) u
       JOIN products p ON p.id = u.product_id
       LEFT JOIN (SELECT product_id, SUM(quantity) AS q FROM product_stock_locations GROUP BY product_id) s ON s.product_id = u.product_id
      WHERE u.n > 0 AND COALESCE(s.q, 0) <> u.n
      ORDER BY p.name`);
  return (rows || []).map(r => ({ productId: r.product_id, sku: r.sku, name: r.name, units: Number(r.units), balance: Number(r.balance) }));
}

async function backfillUnitLocations({ db, incoming, apply, actor, syncProductStock }) {
  const [pending] = await db.query(
    `SELECT u.id, u.product_id FROM units u
       JOIN products p ON p.id = u.product_id
      WHERE u.status IN ('available','reserved') AND u.deposit_id IS NULL`);
  const pendingProducts = new Set((pending || []).map(u => String(u.product_id)));
  const skipped = (await stockMismatches(db)).filter(m => pendingProducts.has(String(m.productId)));
  const skippedIds = new Set(skipped.map(s => String(s.productId)));
  const candidates = (pending || []).filter(u => !skippedIds.has(String(u.product_id)));
  if (!apply) return { moved: candidates.map(u => ({ unitId: u.id, productId: u.product_id })), skipped };
  await db.beginTransaction();
  try {
    const moved = [];
    for (const u of candidates) {
      const [result] = await db.query("UPDATE units SET deposit_id = ?, location_id = ? WHERE id = ? AND deposit_id IS NULL AND status IN ('available','reserved')",
        [incoming.depositId, incoming.locationId, u.id]);
      if (result?.affectedRows !== 1) continue;
      await recordUnitEvent(db, { unitId: u.id, productId: u.product_id, eventType: 'location_set', actor,
        to: incoming, reason: 'Local inicial na implantação: todo aparelho começa no Depósito.' });
      moved.push({ unitId: u.id, productId: u.product_id });
    }
    for (const productId of [...new Set(moved.map(m => m.productId))]) {
      await syncProductStock(productId, db, { stockLocationInTransaction: true });
    }
    await db.commit();
    return { moved, skipped };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

module.exports = {
  UNIT_EVENTS_TABLE, unitEventsMigration, withIncomingDefault, isReturnFromSale, recordUnitEvent,
  transferUnits, stockMismatches, backfillUnitLocations,
};
