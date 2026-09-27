'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrint3dAuthSecurity } = require('../services/print3dAuthSecurity.cjs');
const { createStorefrontAuthSecurity } = require('../services/storefrontAuthSecurity.cjs');
const { verificationClientIp } = require('../services/customerPhoneVerificationServer.cjs');
const config = { secret: 'unit-test-secret-with-at-least-32-bytes', turnstileSecret: 'test-only', publicUrl: 'https://3d.example.test' };

// In-memory transactional adapter. SQL/locking must also be tested in MySQL
// homologation; this suite exercises policy, concurrent callers and rollback.
function database() {
  const rows = new Map();
  let tail = Promise.resolve();
  return { rows, async getConnection() {
    let releaseLock, snapshot;
    return {
      async beginTransaction() {
        const previous = tail; tail = new Promise(resolve => { releaseLock = resolve; });
        await previous; snapshot = structuredClone(rows);
      },
      async query(sql, args) {
        if (sql.startsWith('INSERT')) {
          if (!rows.has(args[0])) rows.set(args[0], { failures: 0, window_start: 0, blocked_until: 0 });
        } else if (sql.startsWith('SELECT')) {
          assert.match(sql, /FOR UPDATE/); return [[{ ...rows.get(args[0]) }]];
        } else if (sql.startsWith('UPDATE')) {
          rows.set(args[3], { failures: args[0], window_start: args[1], blocked_until: args[2] });
        } else if (sql.startsWith('DELETE')) rows.delete(args[0]);
        else throw new Error('Unexpected SQL');
        return [[]];
      },
      async commit() { releaseLock(); releaseLock = undefined; },
      async rollback() { if (releaseLock) { rows.clear(); for (const [k, v] of snapshot) rows.set(k, v); releaseLock(); releaseLock = undefined; } },
      release() {},
    };
  } };
}

test('quinta falha bloqueia a conta entre identificadores e IPs, persiste e expira', async () => {
  const pool = database(); let time = 1_000_000;
  const make = () => createPrint3dAuthSecurity({ ...config, pool, now: () => time });
  let service = make();
  for (let i = 0; i < 5; i++) assert.deepEqual(await service.login({ accountId: 'a', identifier: String(i), ip: String(i), check: async () => false }), { valid: false, blocked: false });
  service = make();
  const attempt = () => service.login({ accountId: 'a', identifier: 'cpf', ip: 'new-ip', check: async () => true });
  assert.equal((await attempt()).blocked, true);
  time += 900001;
  assert.equal((await attempt()).valid, true);
  assert.ok([...pool.rows.keys()].every(key => /^[a-f0-9]{64}$/.test(key)));
});

test('requisições concorrentes não ultrapassam cinco verificações de senha', async () => {
  const pool = database(); const service = createPrint3dAuthSecurity({ ...config, pool }); let checked = 0;
  const results = await Promise.all(Array.from({ length: 12 }, () => service.login({ accountId: 'a', ip: '1', check: async () => { checked++; return false; } })));
  assert.equal(checked, 5); assert.equal(results.filter(item => item.blocked).length, 7);
});

test('limite IP protege múltiplas contas e recuperação limpa somente a conta', async () => {
  const pool = database(); const service = createPrint3dAuthSecurity({ ...config, pool });
  for (let i = 0; i < 30; i++) await service.login({ accountId: String(i), ip: 'same', check: async () => false });
  assert.equal((await service.login({ accountId: 'new', ip: 'same', check: async () => true })).blocked, true);
  for (let i = 0; i < 5; i++) await service.login({ accountId: 'recover', ip: 'other', check: async () => false });
  const connection = await pool.getConnection(); await connection.beginTransaction();
  await service.clearAccount(connection, 'recover'); await connection.commit();
  assert.equal((await service.login({ accountId: 'recover', ip: 'other', check: async () => true })).valid, true);
  assert.equal((await service.login({ accountId: 'recover', ip: 'same', check: async () => true })).blocked, true);
});

test('erro na checagem faz rollback e não deixa lock preso', async () => {
  const pool = database(); const service = createPrint3dAuthSecurity({ ...config, pool });
  await assert.rejects(service.login({ accountId: 'a', ip: '1', check: async () => { throw new Error('db down'); } }));
  assert.equal(pool.rows.size, 0);
  assert.equal((await service.login({ accountId: 'a', ip: '1', check: async () => true })).valid, true);
});

test('Turnstile exige configuração, token, hostname e ação; falhas não liberam operação', async () => {
  const good = { success: true, hostname: '3d.example.test', action: 'print3d_auth' };
  let result = good, calls = 0;
  const service = createPrint3dAuthSecurity({ ...config, fetchImpl: async (url, init) => {
    calls++; assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(JSON.parse(init.body).response, 'opaque-token'); return { ok: true, json: async () => result };
  } });
  await assert.rejects(service.verifyCaptcha(''), { statusCode: 400 }); assert.equal(calls, 0);
  await service.verifyCaptcha('opaque-token');
  for (const invalid of [{ ...good, hostname: 'mercadodovale.com.br' }, { ...good, action: 'other' }, { ...good, success: false, 'error-codes': ['timeout-or-duplicate'] }]) {
    result = invalid; await assert.rejects(service.verifyCaptcha('opaque-token'), { statusCode: 400 });
  }
  await assert.rejects(createPrint3dAuthSecurity({ ...config, turnstileSecret: '' }).verifyCaptcha('x'), { statusCode: 503 });
  await assert.rejects(createPrint3dAuthSecurity({ ...config, fetchImpl: async () => { throw new Error('network'); } }).verifyCaptcha('x'), { statusCode: 503 });
});

test('IP aceita somente proxy local confiável e ignora cabeçalho externo forjado', () => {
  assert.equal(verificationClientIp({ ip: '203.0.113.1', headers: { 'x-forwarded-for': '1.1.1.1' } }), '203.0.113.1');
  assert.equal(verificationClientIp({ ip: '127.0.0.1', headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.2' } }), '203.0.113.2');
});

test('MDV aplica cinco falhas e usa tabela/chaves independentes da loja 3D', async () => {
  const pool = database(); const queries = [];
  const rawConnect = pool.getConnection;
  pool.getConnection = async () => {
    const connection = await rawConnect(); const query = connection.query;
    connection.query = async (sql, args) => { queries.push(sql); return query(sql, args); };
    return connection;
  };
  const mdv = createStorefrontAuthSecurity({ ...config, pool, scope: 'mercado_do_vale' });
  for (let i = 0; i < 5; i++) await mdv.login({ accountId: 'same-account', identifier: `alias-${i}`, ip: 'same-ip', check: async () => false });
  assert.equal((await mdv.login({ accountId: 'same-account', ip: 'different-ip', check: async () => true })).blocked, true);
  assert.ok(queries.every(sql => sql.includes('customer_login_limits') && !sql.includes('print3d_login_limits')));
  const print3d = createPrint3dAuthSecurity({ ...config, pool });
  assert.equal((await print3d.login({ accountId: 'same-account', ip: 'same-ip', check: async () => true })).valid, true);
});
