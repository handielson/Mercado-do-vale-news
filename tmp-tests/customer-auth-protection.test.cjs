const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Fastify = require('fastify');
const { registerCustomerAuthProtection } = require('../services/customerAuthProtection.cjs');
const config = { enabled: true, secret: 'test-secret-with-at-least-thirty-two-bytes', publicUrl: 'https://www.mercadodovale.com.br', turnstileSecret: 'mdv-only-test-secret' };

test('rotas MDV exigem CAPTCHA próprio, sem afetar Google/3D ou GET', async () => {
  const app = Fastify(); let calls = 0;
  registerCustomerAuthProtection(app, { ...config, fetchImpl: async (_url, init) => {
    assert.equal(JSON.parse(init.body).secret, config.turnstileSecret);
    return { ok: true, json: async () => ({ success: true, hostname: 'www.mercadodovale.com.br', action: JSON.parse(init.body).response }) };
  } });
  const paths = ['/auth/login', '/auth/register', '/auth/password', '/auth/password-reset/request', '/auth/password-reset/confirm', '/auth/phone/request', '/auth/phone/verify'];
  for (const path of [...paths, '/print3d/auth/login', '/auth/google/callback']) app.post(path, async () => { calls++; return { ok: true }; });
  app.get('/auth/me', async () => ({ ok: true }));
  try {
    for (const path of paths) {
      assert.equal((await app.inject({ method: 'POST', url: path, payload: {} })).statusCode, 400);
      assert.equal((await app.inject({ method: 'POST', url: path, payload: { captcha_token: 'print3d_auth' } })).statusCode, 400);
    }
    assert.equal(calls, 0);
    assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: { captcha_token: 'mdv_auth' } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/print3d/auth/login', payload: {} })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/auth/google/callback', payload: {} })).statusCode, 200);
    assert.equal((await app.inject('/auth/me')).statusCode, 200);
  } finally { await app.close(); }
});

test('ativação desligada preserva login; ativada sem chave falha fechada', async () => {
  for (const enabled of [false, true]) {
    const app = Fastify();
    const protection = registerCustomerAuthProtection(app, { ...config, enabled, turnstileSecret: '', pool: { getConnection() { throw new Error('Must not access database'); } } });
    app.post('/auth/login', async req => protection.login(req, { accountId: 'a', check: async () => true }));
    try { assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: {} })).statusCode, enabled ? 503 : 200); }
    finally { await app.close(); }
  }
});

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  test(`${file}: recuperação troca senha e libera conta na mesma transação; token não reutiliza`, async () => {
    const source = fs.readFileSync(file, 'utf8'); let handler, used = false;
    const events = [];
    const connection = {
      beginTransaction: async () => events.push('begin'), commit: async () => events.push('commit'),
      rollback: async () => events.push('rollback'), release: () => events.push('release'),
      query: async sql => {
        if (sql.startsWith('SELECT customer_id')) { assert.match(sql, /FOR UPDATE/); return [[{ customer_id: 'a', expires_at: new Date(Date.now() + 60000), used_at: used }]]; }
        if (sql.startsWith('SELECT id')) return [[{ id: 'a', email: null }]];
        if (sql.startsWith('UPDATE customer_auth SET')) { events.push('password'); return [[]]; }
        if (sql.startsWith('UPDATE customer_auth_password_resets')) { events.push('consume'); used = true; return [[]]; }
        throw new Error('Unexpected SQL');
      },
    };
    const context = { fastify: { post(_path, _config, fn) { handler = fn; } }, verificationClientIp: () => 'test',
      ensureCustomerAuthTable: async () => {}, ensurePasswordResetTable: async () => {},
      hashAuthResetToken: token => token, hashVpsPassword: async () => ({ salt: 'salt', hash: 'hash' }),
      pool: { getConnection: async () => connection }, customerAuthProtection: { clearAccount: async (db, id) => { assert.equal(db, connection); assert.equal(id, 'a'); events.push('unlock'); } },
      normalizeAuthEmail: value => value, console,
    };
    vm.runInNewContext(source.slice(source.indexOf("fastify.post('/auth/password-reset/confirm'"), source.indexOf("fastify.post('/auth/admin/users'")), context);
    const reply = { code(value) { this.status = value; return this; }, send(body) { return body; } };
    await handler({ body: { token: 'test', password: 'password-test' } }, reply);
    assert.deepEqual(events, ['begin', 'password', 'consume', 'unlock', 'commit', 'release']);
    events.length = 0;
    await handler({ body: { token: 'test', password: 'password-test' } }, reply);
    assert.equal(reply.status, 400); assert.deepEqual(events, ['begin', 'rollback', 'release']);
  });
}
