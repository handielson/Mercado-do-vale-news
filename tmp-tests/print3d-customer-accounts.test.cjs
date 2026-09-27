'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerPrint3dCustomerAccountRoutes, passwordHash, passwordMatches } = require('../services/print3dCustomerAccountsServer.cjs');

function harness(options = {}) {
  const routes = new Map();
  const fastify = {
    post(path, config, handler) { routes.set(`POST ${path}`, { config, handler }); },
    get(path, config, handler) { routes.set(`GET ${path}`, { config, handler }); },
  };
  const pool = options.pool || { query() { throw new Error('Banco não pode ser acessado'); } };
  registerPrint3dCustomerAccountRoutes(fastify, {
    pool, authSecret: 'secret-that-is-longer-than-thirty-two-bytes', enabled: true,
    publicUrl: 'https://3d.example.test', fromEmail: 'contato@3d.example.test',
    brandName: 'Loja 3D', sendEmail: async () => ({ sent: true }),
    security: { verifyCaptcha: async () => {}, login: async ({ check }) => ({ valid: await check() }), clearAccount: async () => {} },
    ...options,
  });
  async function call(method, path, body = {}, headers = {}) {
    const route = routes.get(`${method} ${path}`);
    const reply = { status: 200, sent: false, code(status) { this.status = status; return this; }, header() { return this; }, send(value) { this.body = value; this.sent = true; return this; } };
    await route.config.preHandler({ body, headers, method }, reply);
    if (reply.body) return { status: reply.status, body: reply.body };
    const result = await route.handler({ body, headers }, reply);
    return { status: reply.status, body: result === reply ? reply.body : result };
  }
  return { call, routes };
}

test('contas 3D ficam desligadas sem configuração e não acessam o banco', async () => {
  const { call } = harness({ enabled: false });
  const result = await call('POST', '/print3d/auth/register', { name: 'Teste', email: 'a@b.com', password: '123456789012' });
  assert.equal(result.status, 503);
  assert.equal((await harness({ publicUrl: 'https://www.mercadodovale.com.br' })
    .call('POST', '/print3d/auth/login', {})).status, 503);
});

test('senha 3D usa hash scrypt e não aceita outra senha', async () => {
  const password = 'senha-muito-forte-123';
  const stored = await passwordHash(password);
  assert.equal(await passwordMatches(password, stored.salt, stored.hash), true);
  assert.equal(await passwordMatches('senha-incorreta', stored.salt, stored.hash), false);
  assert.equal(await passwordMatches(password, stored.salt, 'inválido'), false);
});

test('todas as mutações 3D rejeitam CAPTCHA antes de consultar conta ou enviar mensagens', async () => {
  const security = { verifyCaptcha: async () => { throw Object.assign(new Error('CAPTCHA inválido'), { statusCode: 400 }); } };
  const { call, routes } = harness({ security, phoneEnabled: true,
    google: { enabled: true, clientId: '3d-test.apps.googleusercontent.com', clientSecret: 'test', redirectUri: 'https://api.example.test/print3d/auth/google/callback' },
    sendWhatsApp: async () => { throw new Error('Não deve enviar'); } });
  for (const route of routes.keys()) {
    if (route.startsWith('POST ')) assert.equal((await call('POST', route.slice(5))).status, 400, route);
  }
});

test('configuração padrão sem chave Turnstile impede mutações mesmo com módulo ligado', async () => {
  const { call } = harness({ security: undefined });
  assert.equal((await call('POST', '/print3d/auth/login', {})).status, 503);
});

test('login usa apenas print3d_customers e exige verificação de e-mail', async () => {
  const stored = await passwordHash('senha-muito-forte-123');
  let sqlSeen = [];
  const account = { id: '12345678-1234-1234-1234-123456789abc', name: 'Cliente', email: 'cliente@exemplo.com',
    email_verified_at: null, is_active: 1, salt: stored.salt, password_hash: stored.hash, auth_version: 1 };
  const pool = { async query(sql) { sqlSeen.push(sql); return [[account]]; } };
  const { call } = harness({ pool });
  const body = { email: account.email, password: 'senha-muito-forte-123' };
  assert.equal((await call('POST', '/print3d/auth/login', body)).status, 401);
  account.email_verified_at = new Date();
  const loggedIn = await call('POST', '/print3d/auth/login', body);
  assert.equal(loggedIn.status, 200);
  assert.ok(loggedIn.body.token);
  assert.deepEqual(loggedIn.body.customer, { id: account.id, name: account.name, email: account.email, phone: undefined });
  const me = await call('GET', '/print3d/auth/me', {}, { authorization: `Bearer ${loggedIn.body.token}` });
  assert.equal(me.status, 200);
  account.auth_version = 2;
  assert.equal((await call('GET', '/print3d/auth/me', {}, { authorization: `Bearer ${loggedIn.body.token}` })).status, 401);
  assert.ok(sqlSeen.every(sql => /print3d_customers/.test(sql) && !/\bFROM customers\b/.test(sql)));
});

test('cadastro, confirmação e recuperação são próprios da loja 3D e revogam sessão antiga', async () => {
  const accounts = new Map();
  const tokens = new Map();
  const messages = [];
  const query = async (sql, args = []) => {
    if (sql.includes('SELECT c.id, c.name, c.email') && sql.includes('WHERE c.email')) {
      const account = accounts.get(args[0]);
      return [[...(account ? [account] : [])]];
    }
    if (sql.startsWith('INSERT INTO print3d_customers')) {
      accounts.set(args[2], { id: args[0], name: args[1], email: args[2], is_active: 1,
        email_verified_at: null, auth_version: 1 }); return [[]];
    }
    if (sql.startsWith('INSERT INTO print3d_customer_auth')) {
      const account = [...accounts.values()].find(item => item.id === args[0]);
      Object.assign(account, { password_hash: args[1], salt: args[2] }); return [[]];
    }
    if (sql.includes('INSERT INTO print3d_customer_tokens')) {
      tokens.set(args[3], { customer_id: args[1], purpose: args[2], used: false }); return [[]];
    }
    if (sql.includes('FROM print3d_customer_tokens t')) {
      const token = tokens.get(args[0]);
      const purpose = sql.includes("'verify_email'") ? 'verify_email' : 'reset_password';
      return [[...(token && token.purpose === purpose && !token.used ? [{ customer_id: token.customer_id }] : [])]];
    }
    if (sql.startsWith('UPDATE print3d_customers SET email_verified_at')) {
      [...accounts.values()].find(item => item.id === args[0]).email_verified_at = new Date(); return [[]];
    }
    if (sql.startsWith('UPDATE print3d_customer_auth SET')) {
      const account = [...accounts.values()].find(item => item.id === args[2]);
      Object.assign(account, { password_hash: args[0], salt: args[1], auth_version: account.auth_version + 1 }); return [[]];
    }
    if (sql.startsWith('UPDATE print3d_customer_tokens SET used_at')) {
      if (sql.includes('WHERE token_hash')) tokens.get(args[0]).used = true;
      else for (const token of tokens.values()) if (token.customer_id === args[0] && token.purpose === args[1]) token.used = true;
      return [[]];
    }
    if (sql.includes('WHERE c.id = ? LIMIT 1')) {
      const account = [...accounts.values()].find(item => item.id === args[0]); return [[...(account ? [account] : [])]];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = { query, async getConnection() { return { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
  const { call } = harness({ pool, sendEmail: async message => { messages.push(message); return { sent: true }; } });
  const email = 'cliente@exemplo.com';
  const password = 'senha-muito-forte-123';
  assert.equal((await call('POST', '/print3d/auth/register', { name: 'Cliente', email, password, verification_method: 'email' })).status, 202);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, 'contato@3d.example.test');
  assert.match(messages[0].text, /https:\/\/3d\.example\.test\/conta\/confirmar-email/);
  assert.equal((await call('POST', '/print3d/auth/login', { email, password })).status, 401);
  const verifyToken = new URL(messages[0].text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
  assert.deepEqual((await call('POST', '/print3d/auth/verify-email', { token: verifyToken })).body, { verified: true });
  assert.equal((await call('POST', '/print3d/auth/verify-email', { token: verifyToken })).status, 400);
  const login = await call('POST', '/print3d/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.equal((await call('POST', '/print3d/auth/password/request', { email })).status, 202);
  const resetToken = new URL(messages[1].text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
  assert.deepEqual((await call('POST', '/print3d/auth/password/reset', { token: resetToken,
    password: 'outra-senha-forte-456' })).body, { changed: true });
  assert.equal((await call('POST', '/print3d/auth/login', { email, password })).status, 401);
  assert.equal((await call('GET', '/print3d/auth/me', {}, { authorization: `Bearer ${login.body.token}` })).status, 401);
  assert.equal((await call('POST', '/print3d/auth/login', { email, password: 'outra-senha-forte-456' })).status, 200);
  assert.equal((await call('POST', '/print3d/auth/password/reset', { token: resetToken,
    password: 'terceira-senha-forte-789' })).status, 400);
});

test('WhatsApp valida conta 3D, permite telefone/CPF e recupera senha sem conta MDV', async () => {
  const customers = new Map();
  const auth = new Map();
  const challenges = new Map();
  const limits = new Map();
  const messages = [];
  const phone = '5511987654321';
  const cpf = '52998224725';
  const query = async (raw, args = []) => {
    const sql = raw.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('INSERT IGNORE INTO print3d_phone_verification_limits')) {
      limits.set(args[0], limits.get(args[0]) || { window_start: args[1], last_request: 0, requests: 0 }); return [[]];
    }
    if (sql.startsWith('SELECT * FROM print3d_phone_verification_limits')) return [[limits.get(args[0])]];
    if (sql.startsWith('UPDATE print3d_phone_verification_limits')) {
      limits.set(args[3], { window_start: args[0], last_request: args[1], requests: args[2] }); return [[]];
    }
    if (sql.startsWith('INSERT INTO print3d_phone_verifications')) {
      challenges.set(args[0], { phone: args[0], challenge_id: args[1], owner_key: args[2], code_hash: args[3],
        expires_at: args[4], attempts: 0, sent: 0, consumed: 0, proof_hash: null }); return [[]];
    }
    if (sql.startsWith('SELECT * FROM print3d_phone_verifications')) {
      const row = sql.includes('WHERE phone =') ? challenges.get(args[0])
        : [...challenges.values()].find(item => item.challenge_id === args[0]);
      return [[...(row ? [row] : [])]];
    }
    if (sql.startsWith('UPDATE print3d_phone_verifications')) {
      const row = sql.includes('WHERE phone =') ? challenges.get(args.at(-1))
        : [...challenges.values()].find(item => item.challenge_id === args.at(-1));
      if (sql.includes('SET sent = 1')) row.sent = 1;
      else if (sql.includes('SET consumed = 1')) row.consumed = 1;
      else if (sql.includes('SET proof_hash =')) Object.assign(row, { proof_hash: args[0], proof_expires_at: args[1] });
      else if (sql.includes('SET attempts =')) row.attempts++;
      return [[]];
    }
    if (sql.startsWith('INSERT INTO print3d_customers')) {
      customers.set(args[0], { id: args[0], name: args[1], email: null, phone: args[2], cpf_cnpj: args[3],
        phone_verified_at: new Date(), email_verified_at: null, is_active: 1 }); return [[]];
    }
    if (sql.startsWith('INSERT INTO print3d_customer_auth')) {
      auth.set(args[0], { password_hash: args[1], salt: args[2], auth_version: 1 }); return [[]];
    }
    if (sql.includes('FROM print3d_customers c') && sql.includes('WHERE c.phone = ? LIMIT 1')) {
      const c = [...customers.values()].find(item => item.phone === args[0]);
      return [[...(c ? [{ ...c, ...auth.get(c.id) }] : [])]];
    }
    if (sql.includes('FROM print3d_customers c') && sql.includes('WHERE c.email = ? LIMIT 1')) {
      const c = [...customers.values()].find(item => item.email === args[0]);
      return [[...(c ? [{ ...c, ...auth.get(c.id) }] : [])]];
    }
    if (sql.includes('FROM print3d_customers c') && sql.includes('WHERE c.cpf_cnpj = ? LIMIT 1')) {
      const c = [...customers.values()].find(item => item.cpf_cnpj === args[0]);
      return [[...(c ? [{ ...c, ...auth.get(c.id) }] : [])]];
    }
    if (sql.includes('FROM print3d_customers c') && sql.includes('WHERE c.id = ? LIMIT 1')) {
      const c = customers.get(args[0]); return [[...(c ? [{ ...c, ...auth.get(c.id) }] : [])]];
    }
    if (sql.startsWith('SELECT id FROM print3d_customers WHERE phone =')) {
      const c = [...customers.values()].find(item => item.phone === args[0]); return [[...(c ? [{ id: c.id }] : [])]];
    }
    if (sql.startsWith('UPDATE print3d_customer_tokens SET used_at')) {
      assert.equal(args[1], 'reset_password');
      return [[]];
    }
    if (sql.startsWith('UPDATE print3d_customer_auth SET')) {
      Object.assign(auth.get(args[2]), { password_hash: args[0], salt: args[1], auth_version: auth.get(args[2]).auth_version + 1 });
      return [[]];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = { query, async getConnection() { return { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
  let at = Date.now();
  const { call } = harness({ pool, phoneEnabled: true, phoneNow: () => at,
    sendWhatsApp: async (_phone, text) => { messages.push(text); return { ok: true }; } });
  const first = await call('POST', '/print3d/auth/phone/register/request', { phone });
  assert.equal(first.status, 200);
  const code = messages.at(-1).match(/\b\d{6}\b/)[0];
  const verified = await call('POST', '/print3d/auth/phone/register/verify', { challenge_id: first.body.challenge_id, code });
  const registered = await call('POST', '/print3d/auth/register', { name: 'Cliente 3D', phone, cpf,
    password: 'senha-forte-123456', verification_method: 'whatsapp',
    phone_verification_token: verified.body.phone_verification_token });
  assert.equal(registered.status, 200);
  assert.equal(registered.body.customer.phone, phone);
  assert.equal((await call('POST', '/print3d/auth/login', { identifier_type: 'phone', identifier: phone,
    password: 'senha-forte-123456' })).status, 200);
  assert.equal((await call('POST', '/print3d/auth/login', { identifier_type: 'cpf', identifier: cpf,
    password: 'senha-forte-123456' })).status, 200);
  assert.equal((await call('POST', '/print3d/auth/login', { identifier_type: 'email', identifier: 'cliente@exemplo.com',
    password: 'senha-forte-123456' })).status, 401);
  at += 61_000;
  const reset = await call('POST', '/print3d/auth/password/phone/request', { phone });
  assert.equal(reset.status, 202);
  assert.match(messages.at(-1), /redefinir a senha/);
  const resetCode = messages.at(-1).match(/\b\d{6}\b/)[0];
  const proof = await call('POST', '/print3d/auth/password/phone/verify', { phone,
    challenge_id: reset.body.challenge_id, code: resetCode });
  const changed = await call('POST', '/print3d/auth/password/phone/confirm', { phone,
    phone_verification_token: proof.body.phone_verification_token, password: 'nova-senha-forte-456' });
  assert.deepEqual(changed.body, { changed: true });
  assert.equal((await call('GET', '/print3d/auth/me', {}, { authorization: `Bearer ${registered.body.token}` })).status, 401);
  assert.equal((await call('POST', '/print3d/auth/login', { identifier_type: 'phone', identifier: phone,
    password: 'nova-senha-forte-456' })).status, 200);
});
