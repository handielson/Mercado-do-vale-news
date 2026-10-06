const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshNextPriceListBatch, priceListRecipe } = require('../services/socialStoryPriceListBatches.cjs');

function fixture({ empty = false, started = 0, index = 1 } = {}) {
  const calls = [];
  const batch = { schedule_id: 'schedule', batch_index: index, scheduled_iso: '2030-01-03T11:00:00Z', recipe: JSON.stringify({ brands: ['POCO'], layout: 'list', priceMode: 'card' }), delay_seconds: 15, destinations: '["instagram","whatsapp"]' };
  const connection = {
    beginTransaction: async () => calls.push(['begin']),
    commit: async () => calls.push(['commit']),
    rollback: async () => calls.push(['rollback']),
    release: () => calls.push(['release']),
    query: async (sql, args) => {
      calls.push([sql, args]);
      if (sql.includes('SELECT b.*')) return [empty ? [] : [batch]];
      if (sql.includes('COUNT(*)')) return [[{ total: started }]];
      return [{ affectedRows: 1 }];
    },
  };
  const pool = { getConnection: async () => connection, query: async (sql, args) => { calls.push([sql, args]); return [{}]; } };
  return { pool, calls };
}
const pages = (count) => Array.from({ length: count }, (_, index) => ({ mediaUrl: `https://example.com/current-${index}.png`, label: 'Atual', caption: '' }));

test('refreshes page count once per occurrence and uses identical media for both destinations', async () => {
  const { pool, calls } = fixture();
  let generations = 0;
  const result = await refreshNextPriceListBatch(pool, { generatePhonePriceList: async (recipe) => {
    generations++;
    assert.deepEqual(recipe, { brands: ['POCO'], priceMode: 'card', layout: 'list' });
    return { items: pages(3) };
  } });
  assert.equal(generations, 1);
  assert.equal(result.itemCount, 3);
  const inserts = calls.filter(([sql]) => sql.includes('INSERT INTO social_story_items'));
  assert.deepEqual(inserts.map(([, args]) => args[2]), [1000, 1001, 1002]);
  assert.deepEqual(inserts.map(([, args]) => args[6]), ['2030-01-03 11:00:00', '2030-01-03 11:00:15', '2030-01-03 11:00:30']);
  const deliveries = calls.filter(([sql]) => sql.includes('INSERT INTO social_story_deliveries'));
  assert.equal(deliveries.length, 6);
  for (const [, args] of inserts) {
    assert.deepEqual(deliveries.filter(([, d]) => d[2] === args[0]).map(([, d]) => d[3]), ['instagram', 'whatsapp']);
  }
  for (const [sql, args] of calls.filter(([sql]) => sql.startsWith('DELETE'))) assert.deepEqual(args, ['schedule', 1000, 2000]);
  assert.ok(calls.some(([sql]) => sql === 'commit'));
});

test('no stock cancels the occurrence without publishing the previous preview', async () => {
  const { pool, calls } = fixture();
  assert.equal((await refreshNextPriceListBatch(pool, { generatePhonePriceList: async () => ({ items: [] }) })).itemCount, 0);
  assert.ok(calls.some(([sql]) => sql.includes("SET d.status='cancelled'")));
  assert.ok(!calls.some(([sql]) => sql.startsWith('DELETE') || sql.includes('INSERT INTO social_story_items')));
  assert.ok(calls.some(([sql]) => sql.includes('SET generated_at=NOW()')));
});

test('generation failure rolls back and schedules retry, leaving the old preview blocked', async () => {
  const { pool, calls } = fixture();
  const result = await refreshNextPriceListBatch(pool, { generatePhonePriceList: async () => { throw new Error('Fotos indisponíveis'); } });
  assert.equal(result.retry, true);
  assert.ok(calls.some(([sql]) => sql === 'rollback'));
  assert.ok(calls.some(([sql]) => sql.includes('retry_at=DATE_ADD')));
  assert.ok(!calls.some(([sql]) => sql === 'commit' || sql.includes('SET generated_at=NOW()')));
});

test('completed, cancelled, unapproved, future and already generated occurrences are not selected', async () => {
  const { pool, calls } = fixture({ empty: true });
  assert.equal(await refreshNextPriceListBatch(pool, { generatePhonePriceList: () => assert.fail('must not generate') }), null);
  const sql = calls.find(([sql]) => sql.includes('SELECT b.*'))[0];
  assert.match(sql, /generated_at IS NULL/);
  assert.match(sql, /scheduled_at<=NOW\(\)/);
  assert.match(sql, /status IN \('approved','processing'\)/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
});

test('never replaces a partially published occurrence', async () => {
  const { pool, calls } = fixture({ started: 1 });
  assert.equal((await refreshNextPriceListBatch(pool, { generatePhonePriceList: async () => ({ items: pages(1) }) })).retry, true);
  assert.ok(!calls.some(([sql]) => sql.startsWith('DELETE')));
});

test('each new day regenerates and rejects invalid or partial selections', async () => {
  let count = 0;
  for (const index of [0, 1]) {
    const { pool } = fixture({ index });
    await refreshNextPriceListBatch(pool, { generatePhonePriceList: async () => ({ items: pages(++count) }) });
  }
  assert.equal(count, 2);
  assert.throws(() => priceListRecipe({ brands: ['Other'] }));
  assert.throws(() => priceListRecipe({ groups: [] }));
});
