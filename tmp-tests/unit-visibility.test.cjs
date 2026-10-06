const assert = require('node:assert/strict');
const { setUnitVisibility } = require('../services/unitVisibility.cjs');

function fixture(status, extra = {}) {
  const row = { id: 'u1', product_id: 'p1', status, order_id: null, sale_id: null, internal_notes: 'Nota anterior', ...extra };
  let synced = 0;
  const queries = [];
  const pool = { query: async (sql, args) => {
    queries.push([sql, args]);
    if (sql.startsWith('SELECT')) return [[{ ...row }]];
    assert.match(sql, /AND status = \? AND order_id IS NULL AND sale_id IS NULL/);
    if (row.status !== args[3]) return [{ affectedRows: 0 }];
    row.status = args[0]; row.internal_notes += '\n' + args[1];
    return [{ affectedRows: 1 }];
  } };
  return { row, queries, options: { pool, id: 'u1', reason: 'Não localizado', syncProductStock: async id => { assert.equal(id, 'p1'); synced++; } }, synced: () => synced };
}

(async () => {
  const f = fixture('available');
  const hidden = await setUnitVisibility({ ...f.options, action: 'hide' });
  assert.equal(hidden.status, 'hidden');
  assert.match(hidden.internal_notes, /Nota anterior\n.*Ocultada: Não localizado/);
  assert.equal(f.synced(), 1);
  const restored = await setUnitVisibility({ ...f.options, action: 'restore' });
  assert.equal(restored.status, 'available');
  assert.equal(f.synced(), 2);
  for (const status of ['sold', 'reserved', 'rma', 'scrapped', 'hidden']) {
    const blocked = fixture(status);
    await assert.rejects(setUnitVisibility({ ...blocked.options, action: 'hide' }), error => error.statusCode === 409);
    assert.equal(blocked.row.status, status);
    assert.equal(blocked.synced(), 0);
  }
  const linked = fixture('available', { order_id: 'order1' });
  await assert.rejects(setUnitVisibility({ ...linked.options, action: 'hide' }), error => error.statusCode === 409);
  await assert.rejects(setUnitVisibility({ ...f.options, action: 'hide', reason: '' }), error => error.statusCode === 400);
  await assert.rejects(setUnitVisibility({ ...f.options, action: 'delete' }), error => error.statusCode === 400);
  const raced = fixture('available');
  raced.options.pool.query = async sql => sql.startsWith('SELECT') ? [[raced.row]] : [{ affectedRows: 0 }];
  await assert.rejects(setUnitVisibility({ ...raced.options, action: 'hide' }), error => error.statusCode === 409);
  assert.equal(raced.synced(), 0);
  console.log('Unit visibility hide/restore safeguards passed');
})();
