const test = require('node:test');
const assert = require('node:assert/strict');
const { cancelStoryItems } = require('../services/socialStoryPriceListBatches.cjs');

function fixture({ dynamic = true, processing = false } = {}) {
  const state = { schedule: 'approved', approval: 'approved',
    items: [{ id: 'a', sequence_index: 0 }, { id: 'b', sequence_index: 1 }, { id: 'c', sequence_index: 1000 }],
    deliveries: [{ id: 'da', item: 'a', status: processing ? 'processing' : 'published' }, { id: 'db', item: 'a', status: 'pending' }, { id: 'dc', item: 'b', status: 'pending' }, { id: 'dd', item: 'c', status: 'pending' }],
    batches: dynamic ? [{ batch_index: 0, generated: false }, { batch_index: 1, generated: false }] : [], committed: false };
  let saved;
  const connection = {
    beginTransaction: async () => { saved = structuredClone(state); },
    commit: async () => { state.committed = true; },
    rollback: async () => { Object.assign(state, saved); }, release: () => {},
    query: async (sql, args) => {
      assert.equal(args[0], 'schedule');
      if (sql.startsWith('SELECT status')) return [[{ status: state.schedule }]];
      if (sql.startsWith('SELECT id,sequence_index')) return [state.items.filter(i => args[1].includes(i.id))];
      if (sql.startsWith('SELECT id,status')) return [state.deliveries.filter(d => args[1].includes(d.item))];
      if (sql.startsWith('SELECT batch_index')) return [state.batches];
      if (sql.startsWith('SELECT id FROM social_story_items')) return [state.items.filter(i => i.sequence_index >= args[1] && i.sequence_index < args[2])];
      if (sql.startsWith('UPDATE social_story_price_list_batches')) { state.batches.find(b => b.batch_index === args[1]).generated = true; return [{}]; }
      if (sql.startsWith('UPDATE social_story_deliveries')) {
        let n = 0;
        for (const d of state.deliveries) if (args[1].includes(d.item) && ['pending','waiting_approval'].includes(d.status)) { d.status = 'cancelled'; n++; }
        return [{ affectedRows: n }];
      }
      if (sql.startsWith('SELECT SUM')) return [[{ pending: state.deliveries.filter(d => ['pending','waiting_approval','processing'].includes(d.status)).length, published: state.deliveries.filter(d => d.status === 'published').length }]];
      if (sql.startsWith('UPDATE social_story_schedules')) { state.schedule = 'cancelled'; return [{}]; }
      if (sql.startsWith('UPDATE marketing_approval_requests')) { state.approval = 'cancelled'; return [{}]; }
      throw new Error('Unexpected SQL: ' + sql);
    },
  };
  return { state, pool: { getConnection: async () => connection } };
}

test('cancels only the selected day, keeps published deliveries and blocks regeneration for that occurrence', async () => {
  const { pool, state } = fixture();
  assert.equal((await cancelStoryItems(pool, 'schedule', ['a','b'])).cancelledDeliveries, 2);
  assert.deepEqual(state.deliveries.map(d => d.status), ['published','cancelled','cancelled','pending']);
  assert.deepEqual(state.batches.map(b => b.generated), [true,false]);
  assert.equal(state.schedule, 'approved'); assert.equal(state.approval, 'approved'); assert.equal(state.committed, true);
});

test('static publications can be cancelled individually without touching another publication or day', async () => {
  const { pool, state } = fixture({ dynamic: false });
  await cancelStoryItems(pool, 'schedule', ['b']);
  assert.deepEqual(state.deliveries.map(d => d.status), ['published','pending','cancelled','pending']);
});

test('refuses stale/foreign IDs, duplicate IDs, partial dynamic tables and in-flight deliveries without mutation', async () => {
  for (const [ids, options] of [[['foreign'],{}],[['a','a'],{}],[['a'],{}],[['a','b'],{processing:true}]]) {
    const { pool, state } = fixture(options); const before = structuredClone(state);
    await assert.rejects(cancelStoryItems(pool, 'schedule', ids));
    assert.deepEqual(state, before);
  }
});

test('cancelling the last unpublished day closes the schedule and approval', async () => {
  const { pool, state } = fixture(); state.deliveries[0].status = 'waiting_approval'; state.schedule = 'pending_approval';
  await cancelStoryItems(pool, 'schedule', ['a','b','c']);
  assert.equal(state.schedule, 'cancelled'); assert.equal(state.approval, 'cancelled');
  assert.ok(state.deliveries.every(d => d.status === 'cancelled'));
});
