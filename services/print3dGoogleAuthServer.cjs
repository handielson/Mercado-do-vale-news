'use strict';
const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { signGoogleState, verifyGoogleState } = require('./customerGoogleAuthServer.cjs');
const { signPrint3dCustomerSession } = require('./print3dCustomerSession.cjs');
const { verificationClientIp } = require('./customerPhoneVerificationServer.cjs');
const HASH = /^[a-f0-9]{64}$/;
const COOKIE = '__Secure-print3d_google';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function google3dConfig(options) {
  try {
    const app = new URL(options.publicUrl), callback = new URL(options.google?.redirectUri);
    const clientId = String(options.google?.clientId || '');
    const clientSecret = String(options.google?.clientSecret || '');
    const valid = options.configured && options.google?.enabled === true && clientId.endsWith('.apps.googleusercontent.com')
      && clientSecret && app.protocol === 'https:' && callback.protocol === 'https:'
      && !callback.username && !callback.password && !callback.search && !callback.hash
      && callback.pathname === '/print3d/auth/google/callback'
      && !['mercadodovale.com.br', 'www.mercadodovale.com.br'].includes(app.hostname)
      && clientId !== options.google?.mdvClientId;
    return { configured: Boolean(valid), app, callback, clientId, clientSecret };
  } catch { return { configured: false }; }
}

function registerPrint3dGoogleAuthRoutes(fastify, options) {
  const { pool, authSecret, guard, authenticatedAccount, passwordHash, normalizeEmail,
    now = Date.now, fetchImpl = fetch } = options;
  const config = google3dConfig(options);
  const signingSecret = config.configured ? crypto.createHmac('sha256', authSecret).update('print3d_google_state_v1').digest('hex') : '';
  const verifier = new OAuth2Client();
  const verifyIdentity = options.verifyIdentity || (async token => (await verifier.verifyIdToken({ idToken: token, audience: config.clientId })).getPayload());
  const cookie = (value, age = 600) => `${COOKIE}=${value}; Path=/print3d/auth/google; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
  const parseCookie = request => {
    try {
      const item = String(request.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
      return item ? JSON.parse(Buffer.from(item.slice(COOKIE.length + 1), 'base64url').toString('utf8')) : null;
    } catch { return null; }
  };
  const signed = payload => signGoogleState({ ...payload, nonce: crypto.randomBytes(24).toString('hex'), exp: Math.floor(now() / 1000) + 600 }, signingSecret);
  const read = value => {
    if (typeof value !== 'string' || value.length > 4000) return null;
    return verifyGoogleState(value, signingSecret, Math.floor(now() / 1000));
  };
  const rate = (max, post = false) => ({ config: { rateLimit: { max, timeWindow: '1 hour', keyGenerator: verificationClientIp } },
    preHandler: async (req, reply) => {
      reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
      if (!config.configured) return reply.code(503).send({ error: 'Login Google 3D ainda não disponível.' });
      if (post) return guard(req, reply);
    } });
  const failure = reply => reply.redirect(new URL('/loja-3d/conta?google_error=failed', config.app).toString());

  fastify.get('/print3d/auth/google/config', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store'); return { configured: config.configured };
  });
  fastify.post('/print3d/auth/google/prepare', rate(10, true), async (request, reply) => {
    const challenge = request.body?.browser_challenge;
    if (!HASH.test(String(challenge || ''))) return reply.code(400).send({ error: 'Navegador inválido. Reinicie o login.' });
    const link = request.body?.link === true;
    const account = link ? await authenticatedAccount(request) : null;
    if (link && !account) return reply.code(401).send({ error: 'Entre na sua conta 3D antes de vincular o Google.' });
    const intent = signed({ purpose: 'prepare', challenge, linkId: account?.id || null, linkVersion: account?.auth_version || null });
    const url = new URL('/print3d/auth/google/start', config.callback);
    url.searchParams.set('intent', intent);
    return { url: url.toString() };
  });
  fastify.get('/print3d/auth/google/start', rate(20), async (request, reply) => {
    const intent = read(request.query?.intent);
    if (!intent || intent.purpose !== 'prepare' || !HASH.test(intent.challenge)) return failure(reply);
    const pkce = crypto.randomBytes(48).toString('base64url');
    const oidcNonce = crypto.randomBytes(24).toString('hex');
    const state = signed({ purpose: 'callback', challenge: intent.challenge, linkId: intent.linkId, linkVersion: intent.linkVersion, oidcNonce });
    const stateClaims = read(state);
    reply.header('Set-Cookie', cookie(Buffer.from(JSON.stringify({ nonce: stateClaims.nonce, pkce })).toString('base64url')));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [key, value] of Object.entries({ client_id: config.clientId, redirect_uri: config.callback.toString(),
      response_type: 'code', scope: 'openid email profile', state, nonce: oidcNonce,
      code_challenge: crypto.createHash('sha256').update(pkce).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' })) url.searchParams.set(key, value);
    return reply.redirect(url.toString());
  });
  fastify.get('/print3d/auth/google/callback', rate(30), async (request, reply) => {
    reply.header('Set-Cookie', cookie('', 0));
    const state = read(request.query?.state), saved = parseCookie(request);
    if (request.query?.error || !state || state.purpose !== 'callback' || !saved || saved.nonce !== state.nonce
      || !HASH.test(state.challenge) || typeof saved.pkce !== 'string' || typeof request.query?.code !== 'string') return failure(reply);
    try {
      const response = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(12000),
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback.toString(),
          grant_type: 'authorization_code', code: request.query.code, code_verifier: saved.pkce }),
      });
      const tokens = await response.json();
      if (!response.ok || !tokens.id_token) return failure(reply);
      const identity = await verifyIdentity(tokens.id_token);
      const email = normalizeEmail(identity?.email);
      if (!identity || !email || identity.email_verified !== true || identity.nonce !== state.oidcNonce
        || identity.aud !== config.clientId || (identity.azp && identity.azp !== config.clientId)
        || !['https://accounts.google.com', 'accounts.google.com'].includes(identity.iss)
        || !Number.isFinite(identity.exp) || identity.exp * 1000 <= now()
        || typeof identity.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(identity.sub)) return failure(reply);
      const name = String(identity.name || email.split('@')[0]).replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 255) || 'Cliente';
      const authoritative = email.endsWith('@gmail.com') || Boolean(identity.hd);
      const code = crypto.randomBytes(32).toString('hex');
      await pool.query('DELETE FROM print3d_google_handoffs WHERE expires_at < ? LIMIT 100', [now()]);
      await pool.query(`INSERT INTO print3d_google_handoffs
        (token_hash, browser_challenge, google_sub, email, name, email_authoritative, link_customer_id, link_auth_version, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [hash(code), state.challenge, identity.sub, email, name, authoritative ? 1 : 0, state.linkId, state.linkVersion, now() + 120000]);
      const destination = new URL('/loja-3d/conta/google/callback', config.app);
      destination.hash = new URLSearchParams({ code }).toString();
      return reply.redirect(destination.toString());
    } catch { return failure(reply); }
  });
  fastify.post('/print3d/auth/google/exchange', rate(20, true), async (request, reply) => {
    const code = String(request.body?.code || ''), proof = String(request.body?.browser_verifier || '');
    if (!HASH.test(code) || !HASH.test(proof)) return reply.code(400).send({ error: 'Login inválido. Reinicie o acesso com Google.' });
    const sessionAccount = await authenticatedAccount(request);
    const connection = await pool.getConnection();
    let account;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT * FROM print3d_google_handoffs WHERE token_hash = ? FOR UPDATE', [hash(code)]);
      const handoff = rows[0];
      if (!handoff || Number(handoff.expires_at) <= now() || handoff.browser_challenge !== hash(proof)) throw error('Login expirado ou aberto em outro navegador. Reinicie o acesso com Google.');
      const [identities] = await connection.query('SELECT customer_id FROM print3d_customer_google WHERE google_sub = ? FOR UPDATE', [handoff.google_sub]);
      let customerId = identities[0]?.customer_id;
      if (handoff.link_customer_id) {
        if (!sessionAccount || sessionAccount.id !== handoff.link_customer_id || sessionAccount.auth_version !== handoff.link_auth_version) throw error('Entre novamente na conta 3D para vincular o Google.', 401);
        if (customerId && customerId !== sessionAccount.id) throw error('Essa conta Google já está vinculada a outra conta 3D.', 409);
        customerId = sessionAccount.id;
      }
      if (customerId) {
        const [accounts] = await connection.query(`SELECT c.id, c.name, c.email, c.email_verified_at, c.phone, c.is_active, a.auth_version
          FROM print3d_customers c JOIN print3d_customer_auth a ON a.customer_id = c.id WHERE c.id = ? FOR UPDATE`, [customerId]);
        account = accounts[0];
        if (!account?.is_active) throw error('Conta 3D indisponível.', 403);
        if (handoff.link_customer_id) {
          if (account.auth_version !== handoff.link_auth_version) throw error('Sessão expirada.', 401);
          if ((account.email && account.email !== handoff.email) || (!account.email_verified_at && !handoff.email_authoritative)) throw error('Use o mesmo e-mail confirmado na sua conta 3D para vincular o Google.');
          const [linked] = await connection.query('SELECT google_sub FROM print3d_customer_google WHERE customer_id = ? FOR UPDATE', [account.id]);
          if (linked[0] && linked[0].google_sub !== handoff.google_sub) throw error('Esta conta 3D já possui outro Google vinculado.', 409);
          if (!linked[0]) await connection.query('INSERT INTO print3d_customer_google (customer_id, google_sub) VALUES (?, ?)', [account.id, handoff.google_sub]);
          await connection.query('UPDATE print3d_customers SET email = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [handoff.email, account.id]);
          account.email = handoff.email;
        }
      } else {
        const [existing] = await connection.query('SELECT id FROM print3d_customers WHERE email = ? LIMIT 1 FOR UPDATE', [handoff.email]);
        if (existing[0]) throw error('Já existe uma conta 3D com esse e-mail. Entre com sua senha e escolha Vincular Google.', 409);
        if (!handoff.email_authoritative) throw error('Primeiro crie e confirme sua conta por e-mail. Depois entre e escolha Vincular Google.');
        const id = crypto.randomUUID();
        const { hash: password, salt } = await passwordHash(crypto.randomBytes(48).toString('hex'));
        await connection.query('INSERT INTO print3d_customers (id, name, email, email_verified_at) VALUES (?, ?, ?, UTC_TIMESTAMP())', [id, handoff.name, handoff.email]);
        await connection.query('INSERT INTO print3d_customer_auth (customer_id, password_hash, salt) VALUES (?, ?, ?)', [id, password, salt]);
        await connection.query('INSERT INTO print3d_customer_google (customer_id, google_sub) VALUES (?, ?)', [id, handoff.google_sub]);
        account = { id, name: handoff.name, email: handoff.email, phone: null, auth_version: 1 };
      }
      await connection.query('DELETE FROM print3d_google_handoffs WHERE token_hash = ?', [hash(code)]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      return reply.code(err.statusCode || (err.code === 'ER_DUP_ENTRY' ? 409 : 503)).send({ error: err.statusCode ? err.message : 'Não foi possível concluir o login. Tente novamente.' });
    } finally { connection.release(); }
    return { token: signPrint3dCustomerSession(account.id, authSecret, undefined, account.auth_version),
      customer: { id: account.id, name: account.name, email: account.email, phone: account.phone } };
  });
}
module.exports = { registerPrint3dGoogleAuthRoutes, google3dConfig };
