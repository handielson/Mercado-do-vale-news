const test = require('node:test');
const assert = require('node:assert/strict');
const { automaticRecipe, promotePending } = require('../scripts/enable-dynamic-phone-brands.cjs');
const legacy = { brands: ['Xiaomi', 'POCO', 'realme'], layout: 'list', priceMode: 'cash' };
test('repair changes only verified legacy selection and preserves price and layout', () => {
  assert.deepEqual(automaticRecipe(legacy), { ...legacy, brandMode: 'all', brands: null });
  for (const recipe of [{ ...legacy, brands: ['POCO'] }, { ...legacy, brandMode: 'selected' },
    { ...legacy, brandMode: 'all', brands: null }, { ...legacy, brands: ['Xiaomi', 'POCO', 'realme', 'Oukitel'] }]) {
    assert.equal(automaticRecipe(recipe), null);
  }
});
function fixture({ fail = false } = {}) {
  const calls = [];
  let saved;
  const db = { beginTransaction: async () => calls.push('begin'), commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'),
    query: async (sql, args) => {
      calls.push(sql);
      if (sql.includes('SELECT b.schedule_id')) {
        assert.match(sql, /generated_at IS NULL AND b.scheduled_at>NOW\(\)/);
        assert.match(sql, /status IN \('approved','processing'\)/);
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /d.status IN \('processing','published'\)/);
        assert.match(sql, /FOR UPDATE/);
        assert.equal(args.length, 2);
        return [[{ schedule_id: args[0], batch_index: 1, recipe: JSON.stringify(legacy) }]];
      }
      if (sql.startsWith('UPDATE')) { saved = args[0]; return [{ affectedRows: fail ? 0 : 1 }]; }
      if (sql.startsWith('SELECT recipe')) return [[{ recipe: saved }]];
      assert.fail(sql);
    } };
  return { db, calls };
}
test('dry run does not update and backup precedes every mutation', async () => {
  const first = fixture();
  assert.equal((await promotePending(first.db)).occurrences, 1);
  assert.ok(!first.calls.some(c => c.startsWith('UPDATE')));
  assert.ok(first.calls.includes('rollback'));
  const second = fixture();
  const result = await promotePending(second.db, { apply: true, backup: async rows => {
    assert.equal(rows.length, 1);
    assert.ok(!second.calls.some(c => c.startsWith('UPDATE')));
    second.calls.push('backup');
  } });
  assert.equal(result.occurrences, 1);
  assert.ok(second.calls.includes('commit'));
});
test('missing backup, failed backup or concurrent drift roll back', async () => {
  for (const options of [{}, { backup: async () => { throw Error('backup failed'); } }, { fail: true, backup: async () => {} }]) {
    const { db, calls } = fixture(options);
    await assert.rejects(promotePending(db, { ...options, apply: true }));
    assert.ok(calls.includes('rollback'));
    assert.ok(!calls.includes('commit'));
  }
});
