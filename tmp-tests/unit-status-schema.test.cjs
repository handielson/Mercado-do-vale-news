const test = require('node:test');
const assert = require('node:assert/strict');
const { hiddenStatusAlter, ensureUnitStatusSchema } = require('../services/unitStatusSchema.cjs');
const { patch } = require('../scripts/deploy-unit-visibility-schema.cjs');
const column = { Type: "enum('available','sold','reserved','defective')", Null: 'YES', Default: 'available', Collation: 'utf8mb4_unicode_ci', Extra: '', Comment: '' };
test('legacy enum gains hidden without changing existing values, nullability or default', () => {
  assert.equal(hiddenStatusAlter(column), "ALTER TABLE units MODIFY COLUMN status enum('available','sold','reserved','defective','hidden') COLLATE utf8mb4_unicode_ci NULL DEFAULT 'available'");
  assert.equal(hiddenStatusAlter({ ...column, Type: "enum('available','sold','reserved','defective','hidden')" }), null);
  assert.equal(hiddenStatusAlter({ Type: 'varchar(20)' }), null);
  assert.match(hiddenStatusAlter({ ...column, Null: 'NO', Default: null }), /NOT NULL$/);
  assert.throws(() => hiddenStatusAlter({ ...column, Type: 'int' }), /inesperado/);
});
test('concurrent calls migrate once and failed migration can retry', async () => {
  let reads = 0, writes = 0, fail = true;
  const pool = { query: async sql => { if (sql.startsWith('SHOW')) { reads++; return [[column]]; } writes++; if (fail) throw new Error('ddl failed'); return [{}]; } };
  await assert.rejects(ensureUnitStatusSchema(pool), /ddl failed/);
  fail = false;
  await Promise.all([ensureUnitStatusSchema(pool), ensureUnitStatusSchema(pool)]);
  assert.equal(reads, 2); assert.equal(writes, 2);
});
test('deployment patches only legacy status initialization, preserves other fixes and is idempotent', () => {
  const source = `otherFix();\n  await addColumnIfMissing('units', 'status', "VARCHAR(20) NOT NULL DEFAULT 'available'");\nuntouched();`;
  const result = patch(source);
  assert.equal(patch(result), result);
  assert.ok(result.startsWith('otherFix();')); assert.ok(result.endsWith('untouched();'));
  assert.throws(() => patch(source + source), /diverged/);
  assert.throws(() => patch('different runtime'), /diverged/);
});
