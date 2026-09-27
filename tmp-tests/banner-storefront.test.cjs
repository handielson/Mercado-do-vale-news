const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Fastify = require('fastify');
for (const file of ['vps_server.cjs', 'vps_server.js']) {
  function app({ missing = false } = {}) {
    const server = Fastify();
    const rows = [
      { id: 'old', storefront: 'mercado_do_vale', active: 1, title: 'MDV' },
      { id: 'new', storefront: 'loja_3d', active: 1, title: '3D' },
    ];
    const calls = [];
    const pool = { query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (missing && sql.includes('WHERE storefront=')) throw Object.assign(new Error('column'), { code: 'ER_BAD_FIELD_ERROR' });
      if (sql.startsWith('SELECT')) return [sql.includes('WHERE storefront=') ? rows.filter(row => row.storefront === params[0]) : rows];
      return [{}];
    } };
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('function mapBannerRow(r)');
    const end = source.indexOf('// POST /banners/upload', start);
    vm.runInNewContext(source.slice(start, end), { fastify: server, pool, require,
      requireSyncKey: async (req, reply) => { if (req.headers.authorization !== 'test-admin') return reply.code(401).send({ error: 'auth' }); } });
    return { server, calls };
  }
  test(file + ': listagem padrão MDV e filtro 3D isolam as vitrines', async t => {
    const { server, calls } = app(); t.after(() => server.close());
    assert.deepEqual((await server.inject('/banners')).json().map(x => x.id), ['old']);
    assert.deepEqual((await server.inject('/banners?storefront=loja_3d')).json().map(x => x.id), ['new']);
    assert.equal((await server.inject('/banners?storefront=invalid')).statusCode, 400);
    assert.equal(calls.length, 2);
  });
  test(file + ': antes da migration o 3D não recebe banners MDV', async t => {
    const { server } = app({ missing: true }); t.after(() => server.close());
    assert.equal((await server.inject('/banners?storefront=loja_3d')).statusCode, 503);
    assert.equal((await server.inject('/banners')).statusCode, 200);
  });
  test(file + ': gravação protegida e loja validada antes do SQL', async t => {
    const { server, calls } = app(); t.after(() => server.close());
    assert.equal((await server.inject({ method: 'POST', url: '/banners', payload: { storefront: 'loja_3d' } })).statusCode, 401);
    assert.equal((await server.inject({ method: 'POST', url: '/banners', headers: { authorization: 'test-admin' }, payload: { storefront: 'bad' } })).statusCode, 400);
    assert.equal(calls.length, 0);
    await server.inject({ method: 'POST', url: '/banners', headers: { authorization: 'test-admin' }, payload: { storefront: 'loja_3d', title: '3D' } });
    assert.equal(calls.find(x => x.sql.includes('INSERT INTO banners')).params.at(-1), 'loja_3d');
  });
}
