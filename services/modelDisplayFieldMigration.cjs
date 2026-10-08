'use strict';

const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');
const OLD = 'fps_do_display';
const CANONICAL = 'celular_fps_display';
function object(raw) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}
function empty(value) { return value == null || String(value).trim() === ''; }
// The first rate describes the display; later rates can describe touch sampling
// ("Até 120Hz, toque 240Hz") and must never become the display rate.
function rate(value) {
  if (empty(value)) return null;
  const match = String(value).match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}
function migrateObject(raw) {
  const before = object(raw);
  if (!Object.hasOwn(before, OLD)) return { value: before, changed: false };
  const legacy = before[OLD], current = before[CANONICAL];
  if (!empty(legacy) && empty(current) && rate(legacy) == null) {
    return { value: before, changed: false, blocked: true, conflict: { old: legacy, canonical: null } };
  }
  const value = { ...before };
  if (empty(current) && !empty(legacy)) value[CANONICAL] = String(rate(legacy));
  delete value[OLD];
  return { value, changed: true, ...(!empty(current) && !empty(legacy) && rate(current) !== rate(legacy)
    ? { conflict: { old: legacy, canonical: current, resolution: 'existing-canonical-preserved-in-backup' } } : {}) };
}
function buildPlan({ models = [], products = [], categories = [], fields = [] }) {
  const changes = [], conflicts = [], blocked = [];
  for (const [table, rows, columns] of [
    ['models', models, ['template_values']],
    ['products', products, ['specs', 'custom_fields']],
  ]) for (const row of rows) for (const column of columns) {
    const result = migrateObject(row[column]);
    if (result.conflict) conflicts.push({ table, id: row.id, label: row.name || row.sku, column, ...result.conflict });
    if (result.blocked) blocked.push({ table, id: row.id, column });
    if (result.changed) changes.push({ table, id: row.id, column, before: row[column], after: JSON.stringify(result.value) });
  }
  // Existing canonical values prevail. Conflicting legacy values are retained
  // in the mandatory backup/audit rather than becoming a second authority.
  const removeDefinition = blocked.length === 0;
  if (removeDefinition) for (const row of categories) {
    const before = object(row.config), after = { ...before };
    let changed = Object.hasOwn(after, OLD);
    if (changed) {
      if (!Object.hasOwn(after, CANONICAL)) after[CANONICAL] = after[OLD];
      delete after[OLD];
    }
    if (Array.isArray(after.custom_fields)) {
      after.custom_fields = after.custom_fields.filter(field => field.key !== OLD && !fields.some(def => def.key === OLD && (field.field_id === def.id || field.id === def.id)));
      changed ||= after.custom_fields.length !== before.custom_fields.length;
    }
    if (changed) changes.push({ table: 'categories', id: row.id, column: 'config', before: row.config, after: JSON.stringify(after) });
  }
  return { changes, conflicts, blocked, removeDefinition, deletedFields: removeDefinition ? fields.filter(row => row.key === OLD) : [] };
}
async function run(pool, { apply = false, backupPath } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const lock = apply ? ' FOR UPDATE' : '';
    const [models] = await connection.query(`SELECT id,name,template_values FROM models${lock}`);
    const [products] = await connection.query(`SELECT id,sku,specs,custom_fields FROM products${lock}`);
    const [categories] = await connection.query(`SELECT id,config FROM categories${lock}`);
    const [fields] = await connection.query(`SELECT * FROM custom_fields WHERE \`key\`=?${lock}`, [OLD]);
    const plan = buildPlan({ models, products, categories, fields });
    const report = { apply, changes: plan.changes.length, conflicts: plan.conflicts, blocked: plan.blocked, definitionRemoved: apply && plan.removeDefinition };
    if (!apply) { await connection.rollback(); return report; }
    if (!backupPath) throw new Error('backupPath is required before applying this migration.');
    fs.writeFileSync(backupPath, JSON.stringify({ migration: 'model-display-field-v1', ...plan }, null, 2), { flag: 'wx', mode: 0o600 });
    for (const change of plan.changes) await connection.query(`UPDATE \`${change.table}\` SET \`${change.column}\`=? WHERE id=?`, [change.after, change.id]);
    for (const field of plan.deletedFields) await connection.query('DELETE FROM custom_fields WHERE id=? AND `key`=?', [field.id, OLD]);
    await connection.commit();
    return { ...report, backupPath };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function rollback(pool, backupPath) {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (backup.migration !== 'model-display-field-v1') throw new Error('Invalid migration backup.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const change of backup.changes) {
      if (!['models', 'products', 'categories'].includes(change.table) || !['template_values', 'specs', 'custom_fields', 'config'].includes(change.column)) throw new Error('Invalid backup target.');
      const [[current]] = await connection.query(`SELECT \`${change.column}\` AS value FROM \`${change.table}\` WHERE id=? FOR UPDATE`, [change.id]);
      if (!current || !isDeepStrictEqual(object(current.value), object(change.after))) throw new Error(`Record changed after migration: ${change.table}/${change.id}`);
      await connection.query(`UPDATE \`${change.table}\` SET \`${change.column}\`=? WHERE id=?`, [change.before, change.id]);
    }
    for (const field of backup.deletedFields) {
      const keys = Object.keys(field);
      if (keys.some(key => !/^[a-z_]+$/.test(key))) throw new Error('Invalid backup field.');
      await connection.query(`INSERT INTO custom_fields (${keys.map(key => '\`' + key + '\`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(key => field[key] && typeof field[key] === 'object' ? JSON.stringify(field[key]) : field[key]));
    }
    await connection.commit();
    return { restored: backup.changes.length, definitions: backup.deletedFields.length };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
module.exports = { buildPlan, migrateObject, rate, run, rollback };
