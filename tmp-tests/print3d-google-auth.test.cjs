const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Fastify = require('fastify');
const { registerPrint3dGoogleAuthRoutes, google3dConfig } = require('../services/print3dGoogleAuthServer.cjs');
const { normalizeEmail } = require('../services/print3dCustomerAccountsServer.cjs');
const { verifyPrint3dCustomerSession } = require('../services/print3dCustomerSession.cjs');
const secret = 'test-secret-with-more-than-thirty-two-bytes';
const google = { enabled: true, clientId: '3d.apps.googleusercontent.com', clientSecret: 'test-secret', redirectUri: 'https://api.example.test/print3d/auth/google/callback', mdvClientId: 'mdv.apps.googleusercontent.com' };
const proof = 'a'.repeat(64);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function memoryDb() {
  const state = { customers: new Map(), identities: new Map(), handoffs: new Map() };
  async function query(raw, args) {
    const sql = raw.replace(/\s+/g, ' ').trim();
    assert.doesNotMatch(sql, /(?:FROM|INTO|UPDATE) (?:customers|customer_auth)\b/);
    if (sql.startsWith('DELETE FROM print3d_google_handoffs WHERE expires_at')) return [[]];
    if (sql.startsWith('INSERT INTO print3d_google_handoffs')) {
      const keys = ['token_hash', 'browser_challenge', 'google_sub', 'email', 'name', 'email_authoritative', 'link_customer_id', 'link_auth_version', 'expires_at'];
      state.handoffs.set(args[0], Object.fromEntries(keys.map((key, i) => [key, args[i]]))); return [[]];
    }
    if (sql.startsWith('SELECT * FROM print3d_google_handoffs')) return [[...state.handoffs.values()].filter(row => row.token_hash === args[0])];
    if (sql.startsWith('SELECT customer_id FROM print3d_customer_google')) return [[...(state.identities.has(args[0]) ? [{ customer_id: state.identities.get(args[0]) }] : [])]];
    if (sql.startsWith('SELECT c.id')) return [[...(state.customers.has(args[0]) ? [{ ...state.customers.get(args[0]) }] : [])]];
    if (sql.startsWith('SELECT id FROM print3d_customers')) return [[...state.customers.values()].filter(row => row.email === args[0])];
    if (sql.startsWith('SELECT google_sub')) return [[...state.identities.entries()].filter(([, id]) => id === args[0]).map(([google_sub]) => ({ google_sub }))];
    if (sql.startsWith('INSERT INTO print3d_customers')) { state.customers.set(args[0], { id: args[0], name: args[1], email: args[2], email_verified_at: new Date(), phone: null, is_active: 1, auth_version: 1 }); return [[]]; }
    if (sql.startsWith('INSERT INTO print3d_customer_auth')) return [[]];
    if (sql.startsWith('INSERT INTO print3d_customer_google')) { state.identities.set(args[1], args[0]); return [[]]; }
    if (sql.startsWith('UPDATE print3d_customers SET email')) { state.customers.get(args[1]).email = args[0]; return [[]]; }
    if (sql.startsWith('DELETE FROM print3d_google_handoffs WHERE token_hash')) { state.handoffs.delete(args[0]); return [[]]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
  let tail = Promise.resolve();
  return { state, query, async getConnection() {
    let unlock, snapshot;
    return { query,
      async beginTransaction() { const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous; snapshot = structuredClone(state); },
      async commit() { unlock(); unlock = null; },
      async rollback() { if (unlock) { Object.assign(state, snapshot); unlock(); unlock = null; } }, release() {},
    };
  } };
}
async function harness() {
  const app = Fastify(); const pool = memoryDb(); let identity, activeAccount = null, providerCalls = 0;
  let time = Date.now();
  registerPrint3dGoogleAuthRoutes(app, { pool, configured: true, google, publicUrl: 'https://3d.example.test', authSecret: secret,
    normalizeEmail, passwordHash: async () => ({ salt: 'random-salt', hash: 'unusable-random-password' }), now: () => time,
    guard: async (req, reply) => { if (req.body?.captcha_token !== 'test-captcha') return reply.code(400).send({ error: 'captcha' }); },
    authenticatedAccount: async req => req.headers.authorization === 'Bearer own-account' ? activeAccount : null,
    fetchImpl: async (url, init) => { providerCalls++; assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(init.body.get('client_id'), google.clientId); assert.ok(init.body.get('code_verifier')); return { ok: true, json: async () => ({ id_token: 'signed-token' }) }; },
    verifyIdentity: async () => identity,
  });
  async function prepare(link = false) {
    const response = await app.inject({ method: 'POST', url: '/print3d/auth/google/prepare', headers: { authorization: 'Bearer own-account' }, payload: { browser_challenge: hash(proof), link, captcha_token: 'test-captcha' } });
    assert.equal(response.statusCode, 200);
    const start = new URL(response.json().url);
    const started = await app.inject(start.pathname + start.search);
    const authorization = new URL(started.headers.location);
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    identity = { sub: 'google-stable-sub', email: 'cliente@gmail.com', name: 'Cliente', email_verified: true, aud: google.clientId, iss: 'https://accounts.google.com', exp: Math.floor(time / 1000) + 3600, nonce: authorization.searchParams.get('nonce') };
    return { state: authorization.searchParams.get('state'), cookie: started.headers['set-cookie'].split(';')[0] };
  }
  async function callback(flow, cookie = flow.cookie) {
    return app.inject({ url: `/print3d/auth/google/callback?code=provider-code&state=${encodeURIComponent(flow.state)}`, headers: { cookie } });
  }
  const exchange = (code, verifier = proof) => app.inject({ method: 'POST', url: '/print3d/auth/google/exchange', headers: { authorization: 'Bearer own-account' }, payload: { code, browser_verifier: verifier, captcha_token: 'test-captcha' } });
  const ticket = response => new URLSearchParams(new URL(response.headers.location).hash.slice(1)).get('code');
  return { app, pool, prepare, callback, exchange, ticket, identity: () => identity, calls: () => providerCalls,
    setAccount: account => { activeAccount = account; }, advance: ms => { time += ms; } };
}

test('configuração 3D rejeita cliente OAuth MDV e callback da outra loja', () => {
  const config = { configured: true, google, publicUrl: 'https://3d.example.test' };
  assert.equal(google3dConfig(config).configured, true);
  assert.equal(google3dConfig({ ...config, google: { ...google, clientId: google.mdvClientId } }).configured, false);
  assert.equal(google3dConfig({ ...config, google: { ...google, redirectUri: 'https://api.example.test/auth/google/callback' } }).configured, false);
});

test('Google cria somente conta 3D e código vinculado ao navegador é consumido uma vez', async () => {
  const h = await harness();
  try {
    const flow = await h.prepare(); const cb = await h.callback(flow); const code = h.ticket(cb);
    assert.ok(code); assert.ok(!cb.headers.location.includes('token='));
    assert.equal((await h.exchange(code, 'b'.repeat(64))).statusCode, 400);
    const results = await Promise.all([h.exchange(code), h.exchange(code)]);
    assert.deepEqual(results.map(x => x.statusCode).sort(), [200, 400]);
    const result = results.find(x => x.statusCode === 200).json();
    assert.equal(verifyPrint3dCustomerSession(result.token, secret).storefront, 'loja_3d');
    assert.equal(h.pool.state.customers.size, 1);
    assert.equal(result.customer.phone, null);
    const again = await h.prepare(); h.identity().email = 'novo@gmail.com';
    const second = await h.exchange(h.ticket(await h.callback(again)));
    assert.equal(second.json().customer.id, result.customer.id, 'identity uses sub even if Google email changes');
    assert.equal(h.pool.state.customers.size, 1);
  } finally { await h.app.close(); }
});

test('callback exige cookie/state/nonce/audience/validade antes de emitir handoff', async () => {
  const h = await harness();
  try {
    const flow = await h.prepare();
    assert.match((await h.callback(flow, '')).headers.location, /google_error/); assert.equal(h.calls(), 0);
    assert.match((await h.callback({ ...flow, state: 'forged' })).headers.location, /google_error/); assert.equal(h.calls(), 0);
    for (const patch of [{ nonce: 'wrong' }, { aud: google.mdvClientId }, { iss: 'evil' }, { email_verified: false }, { exp: 0 }]) {
      const next = await h.prepare(); Object.assign(h.identity(), patch);
      assert.match((await h.callback(next)).headers.location, /google_error/);
    }
    assert.equal(h.pool.state.handoffs.size, 0);
    const next = await h.prepare(); h.advance(601000);
    assert.match((await h.callback(next)).headers.location, /google_error/);
  } finally { await h.app.close(); }
});

test('e-mail existente não une conta; vínculo explícito exige sessão atual e mesmo e-mail', async () => {
  const h = await harness();
  try {
    const account = { id: crypto.randomUUID(), email: 'cliente@gmail.com', email_verified_at: new Date(), name: 'Cliente local', auth_version: 1, is_active: 1 };
    h.pool.state.customers.set(account.id, account);
    const flow = await h.prepare();
    assert.equal((await h.exchange(h.ticket(await h.callback(flow)))).statusCode, 409);
    assert.equal(h.pool.state.identities.size, 0);
    h.setAccount(account);
    const link = await h.prepare(true); const code = h.ticket(await h.callback(link));
    h.setAccount(null);
    assert.equal((await h.exchange(code)).statusCode, 401);
    h.setAccount(account);
    assert.equal((await h.exchange(code)).statusCode, 200);
    assert.equal(h.pool.state.identities.get('google-stable-sub'), account.id);
    assert.equal(h.pool.state.customers.size, 1);
  } finally { await h.app.close(); }
});

test('conta inativa e handoff expirado não autenticam', async () => {
  const h = await harness();
  try {
    const first = await h.prepare(); const result = await h.exchange(h.ticket(await h.callback(first)));
    h.pool.state.customers.get(result.json().customer.id).is_active = 0;
    const next = await h.prepare(); const code = h.ticket(await h.callback(next));
    assert.equal((await h.exchange(code)).statusCode, 403);
    h.advance(121000);
    assert.equal((await h.exchange(code)).statusCode, 400);
  } finally { await h.app.close(); }
});

test('Google já vinculado a outro cliente não pode ser transferido por novo vínculo', async () => {
  const h = await harness();
  try {
    const first = await h.prepare(); const original = (await h.exchange(h.ticket(await h.callback(first)))).json().customer;
    const other = { id: crypto.randomUUID(), email: 'cliente@gmail.com', email_verified_at: new Date(), name: 'Other', is_active: 1, auth_version: 1 };
    h.pool.state.customers.set(other.id, other); h.setAccount(other);
    const link = await h.prepare(true);
    assert.equal((await h.exchange(h.ticket(await h.callback(link)))).statusCode, 409);
    assert.equal(h.pool.state.identities.get('google-stable-sub'), original.id);
  } finally { await h.app.close(); }
});

test('e-mail externo ao Gmail/Workspace exige confirmação local antes do primeiro vínculo', async () => {
  const h = await harness();
  try {
    const flow = await h.prepare(); h.identity().email = 'cliente@example.test';
    const result = await h.exchange(h.ticket(await h.callback(flow)));
    assert.equal(result.statusCode, 400); assert.equal(h.pool.state.customers.size, 0);
    assert.match(result.json().error, /confirme sua conta por e-mail/);
  } finally { await h.app.close(); }
});
