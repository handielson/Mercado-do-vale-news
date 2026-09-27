'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { signPrint3dCustomerSession, verifyPrint3dCustomerSession } = require('./print3dCustomerSession.cjs');
const { createCustomerPhoneVerification, normalizeVerificationPhone, verificationClientIp } = require('./customerPhoneVerificationServer.cjs');
const { createPrint3dAuthSecurity } = require('./print3dAuthSecurity.cjs');
const { registerPrint3dGoogleAuthRoutes } = require('./print3dGoogleAuthServer.cjs');

const scrypt = promisify(crypto.scrypt);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[a-f0-9]{64}$/i;
const genericMailResponse = { message: 'Se existir uma conta elegível, enviaremos as instruções por e-mail.' };
const genericPhoneResponse = { message: 'Se existir uma conta elegível, enviaremos o código por WhatsApp.' };

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}
function normalizeCpf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return null;
  for (let length = 9; length <= 10; length++) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const check = (sum * 10) % 11 % 10;
    if (check !== Number(digits[length])) return null;
  }
  return digits;
}

function validPassword(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
function tokenHash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
async function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: (await scrypt(password, salt, 64)).toString('hex') };
}
async function passwordMatches(password, salt, stored) {
  if (!/^[a-f0-9]{128}$/i.test(String(stored)) || !/^[a-f0-9]{32}$/i.test(String(salt))) return false;
  const candidate = Buffer.from((await passwordHash(password, salt)).hash, 'hex');
  return crypto.timingSafeEqual(candidate, Buffer.from(stored, 'hex'));
}

function registerPrint3dCustomerAccountRoutes(fastify, options) {
  const { pool, authSecret, enabled, publicUrl, fromEmail, brandName, sendEmail,
    phoneEnabled = false, sendWhatsApp, phoneNow = Date.now } = options;
  const security = options.security || createPrint3dAuthSecurity({
    pool, secret: authSecret, publicUrl, turnstileSecret: options.turnstileSecret,
  });
  let configured = false;
  try {
    const url = new URL(publicUrl);
    configured = enabled === true && url.protocol === 'https:' && url.username === '' && url.password === ''
      && !['mercadodovale.com.br', 'www.mercadodovale.com.br'].includes(url.hostname.toLowerCase())
      && url.pathname === '/' && !url.search && !url.hash && Boolean(normalizeEmail(fromEmail))
      && typeof brandName === 'string' && brandName.trim().length > 0 && brandName.length <= 80
      && typeof authSecret === 'string' && authSecret.length >= 32 && typeof sendEmail === 'function';
  } catch { configured = false; }
  const guard = async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!configured) return reply.code(503).send({ error: 'Contas da loja 3D ainda não estão disponíveis.' });
    if (request.method === 'POST') {
      try { await security.verifyCaptcha(request.body?.captcha_token); }
      catch (error) { return reply.code(error.statusCode || 503).send({ error: error.message }); }
    }
  };
  const rate = max => ({ preHandler: guard, config: { rateLimit: { max, timeWindow: '1 hour', keyGenerator: verificationClientIp } } });
  const phoneConfigured = configured && phoneEnabled === true && typeof sendWhatsApp === 'function';
  const phoneGuard = async (request, reply) => {
    await guard(request, reply);
    if (!reply.sent && !phoneConfigured) return reply.code(503).send({ error: 'Confirmação WhatsApp 3D indisponível.' });
  };
  const phoneRate = max => ({ preHandler: phoneGuard, config: { rateLimit: { max, timeWindow: '1 hour', keyGenerator: verificationClientIp } } });

  async function issueToken(customerId, purpose) {
    const raw = crypto.randomBytes(32).toString('hex');
    const expiryMinutes = purpose === 'verify_email' ? 24 * 60 : 30;
    await pool.query(`INSERT INTO print3d_customer_tokens
      (id, customer_id, purpose, token_hash, expires_at)
      VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
    [crypto.randomUUID(), customerId, purpose, tokenHash(raw), expiryMinutes]);
    return raw;
  }
  async function mailToken(email, purpose, raw) {
    const path = purpose === 'verify_email' ? '/conta/confirmar-email' : '/conta/redefinir-senha';
    const link = `${new URL(publicUrl).origin}${path}?token=${raw}`;
    const action = purpose === 'verify_email' ? 'Confirmar e-mail' : 'Redefinir senha';
    const subject = `${action} — ${brandName}`;
    const result = await sendEmail({ to: email, from: fromEmail, fromName: brandName, subject,
      text: `${action}: ${link}\n\nSe você não solicitou isso, ignore esta mensagem.`,
      html: `<p>${escapeHtml(action)} na ${escapeHtml(brandName)}:</p><p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p><p>Se você não solicitou isso, ignore esta mensagem.</p>` });
    if (!result?.sent) throw new Error('Falha no envio do e-mail da loja 3D.');
  }
  async function findAccount(value, field = 'email') {
    if (!['email', 'phone', 'cpf_cnpj'].includes(field)) return null;
    const [rows] = await pool.query(`SELECT c.id, c.name, c.email, c.phone, c.email_verified_at,
      ${phoneEnabled ? 'c.phone_verified_at' : 'NULL AS phone_verified_at'}, c.is_active,
      a.password_hash, a.salt, a.auth_version FROM print3d_customers c
      JOIN print3d_customer_auth a ON a.customer_id = c.id WHERE c.${field} = ? LIMIT 1`, [value]);
    return rows[0] || null;
  }
  async function authenticatedAccount(request) {
    const bearer = /^Bearer (\S+)$/i.exec(String(request.headers.authorization || ''));
    const claims = verifyPrint3dCustomerSession(bearer?.[1], authSecret);
    if (!claims) return null;
    const [rows] = await pool.query(`SELECT c.id, c.name, c.email, c.is_active, c.email_verified_at,
      ${phoneEnabled ? 'c.phone_verified_at' : 'NULL AS phone_verified_at'}, a.auth_version
      FROM print3d_customers c JOIN print3d_customer_auth a ON a.customer_id = c.id WHERE c.id = ? LIMIT 1`, [claims.customer_id]);
    const account = rows[0];
    return account?.is_active && (account.email_verified_at || account.phone_verified_at)
      && account.auth_version === claims.auth_version ? account : null;
  }
  const phoneVerification = phoneConfigured ? createCustomerPhoneVerification({
    pool, scope: 'loja_3d', createTables: false,
    now: phoneNow,
    secret: crypto.createHmac('sha256', authSecret).update('loja_3d_phone_verification_v1').digest('hex'),
    send: sendWhatsApp,
    getAuth: async request => ({ customerId: (await authenticatedAccount(request))?.id || null }),
  }) : null;

  fastify.post('/print3d/auth/register', rate(5), async (request, reply) => {
    const body = request.body || {};
    const name = String(body.name || '').trim();
    const method = body.verification_method;
    const email = method === 'email' ? normalizeEmail(body.email) : null;
    const phone = method === 'whatsapp' ? normalizeVerificationPhone(body.phone) : null;
    const cpf = body.cpf ? normalizeCpf(body.cpf) : null;
    if (name.length < 2 || name.length > 255 || !validPassword(body.password)
      || (method !== 'email' && method !== 'whatsapp') || (method === 'email' && (!email || body.phone))
      || (method === 'whatsapp' && (!phone || body.email)) || (body.cpf && !cpf)) {
      return reply.code(400).send({ error: 'Escolha e confirme e-mail ou WhatsApp; informe nome e senha de 12 a 128 caracteres.' });
    }
    if (method === 'whatsapp' && !phoneConfigured) return reply.code(503).send({ error: 'Cadastro por WhatsApp indisponível.' });
    if (email && await findAccount(email)) return reply.code(202).send(genericMailResponse);
    const { salt, hash } = await passwordHash(body.password);
    const customerId = crypto.randomUUID();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (method === 'whatsapp') {
        await phoneVerification.consume(connection, body.phone_verification_token, phone, 'registration');
        await connection.query(`INSERT INTO print3d_customers (id, name, phone, cpf_cnpj, phone_verified_at)
          VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`, [customerId, name, phone, cpf]);
      } else {
        await connection.query('INSERT INTO print3d_customers (id, name, email, cpf_cnpj) VALUES (?, ?, ?, ?)', [customerId, name, email, cpf]);
      }
      await connection.query('INSERT INTO print3d_customer_auth (customer_id, password_hash, salt) VALUES (?, ?, ?)', [customerId, hash, salt]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return method === 'whatsapp'
        ? reply.code(409).send({ error: 'Este WhatsApp ou CPF já está vinculado a uma conta 3D.' })
        : reply.code(202).send(genericMailResponse);
      throw error;
    } finally { connection.release(); }
    if (method === 'whatsapp') return { token: signPrint3dCustomerSession(customerId, authSecret),
      customer: { id: customerId, name, email: null, phone } };
    const raw = await issueToken(customerId, 'verify_email');
    await mailToken(email, 'verify_email', raw);
    return reply.code(202).send(genericMailResponse);
  });

  fastify.post('/print3d/auth/phone/register/request', phoneRate(10), request =>
    phoneVerification.requestCode({ ...request, body: { phone: request.body?.phone, purpose: 'registration' } }));
  fastify.post('/print3d/auth/phone/register/verify', phoneRate(30), request =>
    phoneVerification.verifyCode({ ...request, body: {
      challenge_id: request.body?.challenge_id, code: request.body?.code, purpose: 'registration',
    } }));

  fastify.post('/print3d/auth/verification/request', rate(5), async (request, reply) => {
    const email = normalizeEmail(request.body?.email);
    if (!email) return reply.code(202).send(genericMailResponse);
    const account = await findAccount(email);
    if (account?.is_active && !account.email_verified_at) {
      const raw = await issueToken(account.id, 'verify_email');
      await mailToken(email, 'verify_email', raw);
    }
    return reply.code(202).send(genericMailResponse);
  });

  fastify.post('/print3d/auth/verify-email', rate(10), async (request, reply) => {
    const raw = String(request.body?.token || '');
    if (!TOKEN.test(raw)) return reply.code(400).send({ error: 'Link inválido ou expirado.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT t.customer_id FROM print3d_customer_tokens t
        JOIN print3d_customers c ON c.id = t.customer_id
        WHERE t.token_hash = ? AND t.purpose = 'verify_email' AND t.used_at IS NULL
        AND t.expires_at > UTC_TIMESTAMP() AND c.is_active = 1 LIMIT 1 FOR UPDATE`, [tokenHash(raw)]);
      if (!rows[0]) { await connection.rollback(); return reply.code(400).send({ error: 'Link inválido ou expirado.' }); }
      await connection.query('UPDATE print3d_customers SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [rows[0].customer_id]);
      await connection.query('UPDATE print3d_customer_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?', [tokenHash(raw)]);
      await connection.commit();
      return { verified: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.post('/print3d/auth/login', rate(60), async (request, reply) => {
    const method = request.body?.identifier_type || (request.body?.email ? 'email' : null);
    const identifier = method === 'email' ? normalizeEmail(request.body?.identifier || request.body?.email)
      : method === 'phone' ? normalizeVerificationPhone(request.body?.identifier || request.body?.phone)
        : method === 'cpf' ? normalizeCpf(request.body?.identifier || request.body?.cpf) : null;
    const password = request.body?.password;
    if (!identifier || typeof password !== 'string' || password.length > 128) return reply.code(401).send({ error: 'Credenciais inválidas.' });
    const account = await findAccount(identifier, method === 'cpf' ? 'cpf_cnpj' : method);
    const attempt = await security.login({ accountId: account?.id, identifier: `${method}:${identifier}`, ip: verificationClientIp(request),
      check: async () => {
        // Spend the same password-hash work even when no eligible account exists.
        const matches = await passwordMatches(password, account?.salt || '0'.repeat(32), account?.password_hash || '0'.repeat(128));
        return Boolean(account?.is_active && (account.email_verified_at || account.phone_verified_at)
          && (method !== 'email' || account.email_verified_at) && (method !== 'phone' || account.phone_verified_at) && matches);
      },
    });
    if (attempt.blocked) {
      return reply.header('Retry-After', '900').code(429).send({ error: 'Muitas tentativas. Aguarde 15 minutos ou recupere sua senha pelo canal confirmado.' });
    }
    if (!attempt.valid) {
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }
    return { token: signPrint3dCustomerSession(account.id, authSecret, undefined, account.auth_version),
      customer: { id: account.id, name: account.name, email: account.email, phone: account.phone } };
  });

  fastify.post('/print3d/auth/password/request', rate(5), async (request, reply) => {
    const email = normalizeEmail(request.body?.email);
    if (email) {
      const account = await findAccount(email);
      if (account?.is_active && account.email_verified_at) {
        const raw = await issueToken(account.id, 'reset_password');
        await mailToken(email, 'reset_password', raw);
      }
    }
    return reply.code(202).send(genericMailResponse);
  });

  fastify.post('/print3d/auth/password/reset', rate(10), async (request, reply) => {
    const raw = String(request.body?.token || '');
    if (!TOKEN.test(raw) || !validPassword(request.body?.password)) {
      return reply.code(400).send({ error: 'Link inválido ou senha fora do padrão.' });
    }
    const { salt, hash } = await passwordHash(request.body.password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT t.customer_id FROM print3d_customer_tokens t
        JOIN print3d_customers c ON c.id = t.customer_id
        WHERE t.token_hash = ? AND t.purpose = 'reset_password' AND t.used_at IS NULL
        AND t.expires_at > UTC_TIMESTAMP() AND c.is_active = 1 AND c.email_verified_at IS NOT NULL
        LIMIT 1 FOR UPDATE`, [tokenHash(raw)]);
      if (!rows[0]) { await connection.rollback(); return reply.code(400).send({ error: 'Link inválido ou expirado.' }); }
      await connection.query('UPDATE print3d_customer_auth SET password_hash = ?, salt = ?, auth_version = auth_version + 1 WHERE customer_id = ?', [hash, salt, rows[0].customer_id]);
      await connection.query('UPDATE print3d_customer_tokens SET used_at = UTC_TIMESTAMP() WHERE customer_id = ? AND purpose = ?', [rows[0].customer_id, 'reset_password']);
      await security.clearAccount(connection, rows[0].customer_id);
      await connection.commit();
      return { changed: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.post('/print3d/auth/password/phone/request', phoneRate(5), async (request, reply) => {
    const phone = normalizeVerificationPhone(request.body?.phone);
    if (!phone) return reply.code(400).send({ error: 'Informe um WhatsApp válido.' });
    const account = await findAccount(phone, 'phone');
    if (!account?.is_active || !account.phone_verified_at) return reply.code(202).send({
      ...genericPhoneResponse, challenge_id: crypto.randomBytes(24).toString('hex'), expires_in: 600, retry_after: 60,
    });
    const challenge = await phoneVerification.requestCode({ ...request, body: { phone, purpose: 'password_reset' } });
    return reply.code(202).send({ ...genericPhoneResponse, ...challenge });
  });
  fastify.post('/print3d/auth/password/phone/verify', phoneRate(30), async (request, reply) => {
    const phone = normalizeVerificationPhone(request.body?.phone);
    if (!phone) return reply.code(400).send({ error: 'Informe um WhatsApp válido.' });
    return phoneVerification.verifyCode({ ...request, body: {
      phone, challenge_id: request.body?.challenge_id, code: request.body?.code, purpose: 'password_reset',
    } });
  });
  fastify.post('/print3d/auth/password/phone/confirm', phoneRate(10), async (request, reply) => {
    const phone = normalizeVerificationPhone(request.body?.phone);
    if (!phone || !validPassword(request.body?.password)) return reply.code(400).send({ error: 'WhatsApp ou senha inválidos.' });
    const { salt, hash } = await passwordHash(request.body.password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT id FROM print3d_customers
        WHERE phone = ? AND phone_verified_at IS NOT NULL AND is_active = 1 FOR UPDATE`, [phone]);
      if (!rows[0]) { await connection.rollback(); return reply.code(400).send({ error: 'Confirmação inválida ou expirada.' }); }
      await phoneVerification.consume(connection, request.body?.phone_verification_token, phone, `reset:${phone}`);
      await connection.query(`UPDATE print3d_customer_auth SET password_hash = ?, salt = ?,
        auth_version = auth_version + 1 WHERE customer_id = ?`, [hash, salt, rows[0].id]);
      await connection.query('UPDATE print3d_customer_tokens SET used_at = UTC_TIMESTAMP() WHERE customer_id = ? AND purpose = ?', [rows[0].id, 'reset_password']);
      await security.clearAccount(connection, rows[0].id);
      await connection.commit();
      return { changed: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.get('/print3d/auth/me', rate(60), async (request, reply) => {
    const account = await authenticatedAccount(request);
    if (!account) return reply.code(401).send({ error: 'Sessão inválida.' });
    return { customer: { id: account.id, name: account.name, email: account.email } };
  });

  fastify.post('/print3d/auth/phone/request', phoneRate(10), async (request, reply) => {
    const account = await authenticatedAccount(request);
    if (!account) return reply.code(401).send({ error: 'Sessão inválida.' });
    return phoneVerification.requestCode({ ...request, body: { phone: request.body?.phone, purpose: 'profile' } });
  });
  fastify.post('/print3d/auth/phone/verify', phoneRate(30), async (request, reply) => {
    const account = await authenticatedAccount(request);
    if (!account) return reply.code(401).send({ error: 'Sessão inválida.' });
    return phoneVerification.verifyCode({ ...request, body: {
      challenge_id: request.body?.challenge_id, code: request.body?.code, purpose: 'profile',
    } });
  });
  fastify.post('/print3d/auth/phone/confirm', phoneRate(10), async (request, reply) => {
    const account = await authenticatedAccount(request);
    if (!account) return reply.code(401).send({ error: 'Sessão inválida.' });
    const phone = normalizeVerificationPhone(request.body?.phone);
    if (!phone) return reply.code(400).send({ error: 'Informe um WhatsApp válido.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT c.id FROM print3d_customers c
        JOIN print3d_customer_auth a ON a.customer_id = c.id
        WHERE c.id = ? AND c.is_active = 1
          AND (c.email_verified_at IS NOT NULL OR c.phone_verified_at IS NOT NULL)
          AND a.auth_version = ? FOR UPDATE`, [account.id, account.auth_version]);
      if (!rows[0]) { await connection.rollback(); return reply.code(401).send({ error: 'Sessão inválida.' }); }
      await phoneVerification.consume(connection, request.body?.phone_verification_token, phone, `profile:${account.id}`);
      await connection.query('UPDATE print3d_customers SET phone = ?, phone_verified_at = UTC_TIMESTAMP() WHERE id = ?', [phone, account.id]);
      await connection.commit();
      return { verified: true, phone };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });
  fastify.get('/print3d/auth/phone/status', phoneRate(60), async (request, reply) => {
    const account = await authenticatedAccount(request);
    if (!account) return reply.code(401).send({ error: 'Sessão inválida.' });
    const [rows] = await pool.query('SELECT phone, phone_verified_at FROM print3d_customers WHERE id = ? LIMIT 1', [account.id]);
    return { phone: rows[0]?.phone || null, verified: Boolean(rows[0]?.phone && rows[0]?.phone_verified_at) };
  });
  registerPrint3dGoogleAuthRoutes(fastify, { pool, authSecret, publicUrl, configured, google: options.google,
    guard, authenticatedAccount, passwordHash, normalizeEmail });
  // Reutiliza a mesma validação de sessão nas áreas privadas da loja.
  return { getCustomer: request => configured ? authenticatedAccount(request) : Promise.resolve(null) };
}

module.exports = { registerPrint3dCustomerAccountRoutes, normalizeEmail, passwordHash, passwordMatches };
