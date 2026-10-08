const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Fastify = require('fastify');

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  test(file + ': complete order commits together; failed updates roll back', async () => {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf("fastify.post('/catalog/sections/reorder'");
    const end = source.indexOf("\n});", start) + 4;
    assert.ok(start > 0);
    let saved = { a: 0, b: 1, c: 2 };
    let failAt = -1;
    let acquired = 0, released = 0, commits = 0, rollbacks = 0;
    const pool = { getConnection: async () => {
      acquired++;
      let draft;
      let updates = 0;
      return {
        beginTransaction: async () => { draft = { ...saved }; },
        query: async (sql, params) => {
          if (sql.startsWith('SELECT')) {
            assert.match(sql, /ORDER BY id FOR UPDATE$/);
            return [Object.keys(draft).map(id => ({ id }))];
          }
          assert.equal(sql, 'UPDATE catalog_sections SET display_order = ? WHERE id = ?');
          if (++updates === failAt) throw new Error('simulated database failure');
          draft[params[1]] = params[0];
          // Intermediate changes must never reach the committed state.
          if (failAt > 0) assert.deepEqual(saved, { a: 0, b: 1, c: 2 });
          return [{ affectedRows: 1 }];
        },
        commit: async () => { saved = draft; commits++; },
        rollback: async () => { rollbacks++; },
        release: () => { released++; },
      };
    }};
    const app = Fastify();
    const guard = async (req, reply) => {
      if (req.headers.authorization !== 'Bearer admin') return reply.code(401).send({ error: 'Unauthorized' });
    };
    new Function('fastify', 'pool', 'requireSyncKeyOrAdmin', source.slice(start, end))(app, pool, guard);
    const send = payload => app.inject({
      method: 'POST', url: '/catalog/sections/reorder',
      headers: { authorization: 'Bearer admin' }, payload,
    });
    assert.equal((await app.inject({ method: 'POST', url: '/catalog/sections/reorder', payload: { section_ids: ['c', 'b', 'a'] } })).statusCode, 401);
    assert.equal(acquired, 0);
    for (const ids of [null, ['a', 'a', 'c'], ['a', 2, 'c'], [''], Array(1001).fill('a')]) {
      assert.equal((await send({ section_ids: ids })).statusCode, 400);
    }
    assert.equal(acquired, 0);
    for (const ids of [['a', 'b'], ['a', 'b', 'missing'], []]) {
      assert.equal((await send({ section_ids: ids })).statusCode, 409);
      assert.deepEqual(saved, { a: 0, b: 1, c: 2 });
    }
    for (failAt of [1, 2, 3]) {
      assert.equal((await send({ section_ids: ['c', 'b', 'a'] })).statusCode, 500);
      assert.deepEqual(saved, { a: 0, b: 1, c: 2 });
      assert.equal(commits, 0);
    }
    failAt = -1;
    assert.equal((await send({ section_ids: ['c', 'b', 'a'] })).statusCode, 200);
    assert.deepEqual(saved, { c: 0, b: 1, a: 2 });
    assert.equal(commits, 1);
    assert.equal(rollbacks, 6);
    assert.equal(released, acquired);
    await app.close();
  });
}

test('service sends one request and only invalidates cache after success', async () => {
  const source = fs.readFileSync('services/catalogSectionsService.ts', 'utf8');
  const method = source.split('async reorderSections(sectionIds: string[]): Promise<void> {')[1].split('\n    /**')[0].trim().replace(/}\s*$/, '');
  let calls = 0, cleared = 0, fail = false;
  const reorder = new Function('vpsClient', 'return async function(sectionIds) {' + method + '}')({
    post: async (path, body) => {
      calls++;
      assert.equal(path, '/catalog/sections/reorder');
      assert.deepEqual(body, { section_ids: ['b', 'a'] });
      if (fail) throw new Error('offline');
    },
  });
  const context = { clearCache: () => cleared++ };
  await reorder.call(context, ['b', 'a']);
  assert.equal(calls, 1);
  assert.equal(cleared, 1);
  fail = true;
  await assert.rejects(reorder.call(context, ['b', 'a']), /offline/);
  assert.equal(calls, 2);
  assert.equal(cleared, 1);
});

test('panel blocks overlapping clicks, restores the list on failure and unlocks', async () => {
  const source = fs.readFileSync('components/admin/SectionsTab.tsx', 'utf8');
  for (const [name, index] of [['handleMoveUp', 1], ['handleMoveDown', 0]]) {
    const start = source.indexOf('const ' + name + ' = async (index: number) => {');
    const body = source.slice(start, source.indexOf('\n    };', start) + 7).replace('index: number', 'index');
    const sections = [{ id: 'a', display_order: 0 }, { id: 'b', display_order: 1 }];
    const pending = { current: false };
    let shown = sections, saving = false, calls = 0, alerts = 0, loads = 0;
    let rejectRequest;
    const handler = new Function(
      'sections', 'reorderPending', 'setReordering', 'setSections', 'catalogSectionsService', 'alert', 'loadSections',
      body + '; return ' + name
    )(sections, pending, value => saving = value, value => shown = value, {
      reorderSections: async ids => {
        calls++;
        assert.deepEqual(ids, ['b', 'a']);
        await new Promise((resolve, reject) => { rejectRequest = reject; });
      },
    }, () => alerts++, async () => { loads++; });
    const first = handler(index);
    assert.equal(saving, true);
    assert.deepEqual(shown.map(row => row.id), ['b', 'a']);
    await handler(index);
    assert.equal(calls, 1);
    rejectRequest(new Error('simulated failure'));
    await first;
    assert.deepEqual(shown, sections);
    assert.equal(alerts, 1);
    assert.equal(loads, 1);
    assert.equal(saving, false);
    assert.equal(pending.current, false);
  }
});
