const crypto = require('crypto');

const GOOGLE_OAUTH_COOKIE = 'mdv_google_oauth';
const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;

function safeGoogleNextPath(value) {
  const next = String(value || '/').trim();
  if (!next.startsWith('/') || next.startsWith('//') || /[\r\n]/.test(next)) return '/';
  return next.slice(0, 1000);
}

function safeGoogleErrorCode(value) {
  return String(value || 'oauth_failed').replace(/[^a-z0-9_-]/gi, '').slice(0, 80) || 'oauth_failed';
}

function getGoogleLoginConfig(env = process.env) {
  const clientId = String(env.GOOGLE_LOGIN_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(env.GOOGLE_LOGIN_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(
    env.GOOGLE_LOGIN_REDIRECT_URI ||
    env.GOOGLE_OAUTH_REDIRECT_URI ||
    'https://api.xiaomipetrolina.com.br/auth/google/callback'
  ).trim();
  return { clientId, clientSecret, redirectUri, configured: Boolean(clientId && clientSecret && redirectUri) };
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signGoogleState(payload, secret) {
  const body = encodeJson(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyGoogleState(state, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.nonce || !payload?.exp || Number(payload.exp) < nowSeconds) return null;
    return { ...payload, next: safeGoogleNextPath(payload.next) };
  } catch {
    return null;
  }
}

function parseCookie(request, name) {
  const header = String(request.headers?.cookie || '');
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return '';
}

function buildOauthCookie(value, maxAge = GOOGLE_OAUTH_TTL_SECONDS) {
  return `${GOOGLE_OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/auth/google; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function decodeOauthCookie(value) {
  try {
    const decoded = JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
    if (!decoded?.nonce || !decoded?.verifier) return null;
    return decoded;
  } catch {
    return null;
  }
}

function buildGoogleErrorUrl(publicAppUrl, code) {
  const url = new URL('/cliente/login', publicAppUrl);
  url.searchParams.set('google_error', safeGoogleErrorCode(code));
  return url.toString();
}

function sanitizeGoogleName(value, email) {
  const clean = String(value || '')
    .replace(/[^\p{L}\p{N}\s'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
  if (clean.length >= 2) return clean;
  return String(email || 'Cliente').split('@')[0].replace(/[._-]+/g, ' ').trim().slice(0, 255) || 'Cliente';
}

async function findGoogleCustomer(pool, email) {
  const [authRows] = await pool.query(
    `SELECT c.* FROM customer_auth ca
     JOIN customers c ON c.id = ca.customer_id
     WHERE LOWER(ca.email) = ?
     LIMIT 2`,
    [email]
  );
  if (authRows.length === 1) return { customer: authRows[0], ambiguous: false };
  if (authRows.length > 1) return { customer: null, ambiguous: true };

  const [customerRows] = await pool.query(
    'SELECT * FROM customers WHERE LOWER(email) = ? LIMIT 2',
    [email]
  );
  if (customerRows.length === 1) return { customer: customerRows[0], ambiguous: false };
  return { customer: null, ambiguous: customerRows.length > 1 };
}

function registerCustomerGoogleAuthRoutes(fastify, {
  pool,
  authSecret,
  authResponseForCustomer,
  getPublicAppUrl,
  normalizeAuthEmail,
  normalizeAuthCustomerType,
}) {
  const publicAppUrl = () => String(getPublicAppUrl()).replace(/\/+$/, '');
  const redirectError = (reply, code) => reply.redirect(buildGoogleErrorUrl(publicAppUrl(), code));

  fastify.get('/auth/google/config', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    const config = getGoogleLoginConfig();
    return { configured: config.configured };
  });

  fastify.get('/auth/google/start', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const config = getGoogleLoginConfig();
    if (!config.configured) return redirectError(reply, 'not_configured');

    const nonce = crypto.randomBytes(24).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = signGoogleState({
      nonce,
      next: safeGoogleNextPath(request.query?.next),
      exp: Math.floor(Date.now() / 1000) + GOOGLE_OAUTH_TTL_SECONDS,
    }, authSecret);

    reply.header('Set-Cookie', buildOauthCookie(encodeJson({ nonce, verifier })));
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid email profile');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', challenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('prompt', 'select_account');
    return reply.redirect(authorizationUrl.toString());
  });

  fastify.get('/auth/google/callback', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    reply.header('Set-Cookie', buildOauthCookie('', 0));
    const config = getGoogleLoginConfig();
    if (!config.configured) return redirectError(reply, 'not_configured');
    if (request.query?.error) return redirectError(reply, 'cancelled');

    const state = verifyGoogleState(request.query?.state, authSecret);
    const oauthCookie = decodeOauthCookie(parseCookie(request, GOOGLE_OAUTH_COOKIE));
    if (!state || !oauthCookie || !safeEqual(state.nonce, oauthCookie.nonce)) {
      return redirectError(reply, 'invalid_state');
    }
    const code = String(request.query?.code || '').trim();
    if (!code) return redirectError(reply, 'missing_code');

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          code_verifier: oauthCookie.verifier,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.id_token) return redirectError(reply, 'token_exchange_failed');

      const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
      tokenInfoUrl.searchParams.set('id_token', tokenData.id_token);
      const infoResponse = await fetch(tokenInfoUrl, { signal: AbortSignal.timeout(12_000) });
      const identity = await infoResponse.json().catch(() => ({}));
      const email = normalizeAuthEmail(identity.email);
      const verified = identity.email_verified === true || String(identity.email_verified) === 'true';
      const validIssuer = ['accounts.google.com', 'https://accounts.google.com'].includes(String(identity.iss || ''));
      if (!infoResponse.ok || identity.aud !== config.clientId || !validIssuer || !verified || !email) {
        return redirectError(reply, 'identity_invalid');
      }

      let { customer, ambiguous } = await findGoogleCustomer(pool, email);
      if (ambiguous) return redirectError(reply, 'email_conflict');
      if (customer && normalizeAuthCustomerType(customer.customer_type) === 'ADMIN') {
        return redirectError(reply, 'admin_login_required');
      }
      if (!customer) {
        const id = crypto.randomUUID();
        const companyId = String(process.env.COMPANY_ID || process.env.VITE_COMPANY_ID || '9717131e-7b14-4aec-84a4-4317c0489985');
        const referralCode = `MV-${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
        await pool.query(
          `INSERT INTO customers
           (id, user_id, company_id, name, email, customer_type, is_active, account_status, referral_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?, NOW(), NOW())`,
          [id, id, companyId, sanitizeGoogleName(identity.name, email), email, normalizeAuthCustomerType('customer'), referralCode]
        );
        const [createdRows] = await pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
        customer = createdRows[0] || null;
      }
      if (!customer || customer.is_active === 0 || customer.account_status === 'pending') {
        return redirectError(reply, 'account_inactive');
      }

      const session = authResponseForCustomer(customer);
      const callbackUrl = new URL('/auth/callback', publicAppUrl());
      callbackUrl.hash = new URLSearchParams({ token: session.token, next: state.next }).toString();
      return reply.redirect(callbackUrl.toString());
    } catch (error) {
      console.error('[auth/google] callback failed', {
        message: error?.message || String(error),
      });
      return redirectError(reply, 'oauth_failed');
    }
  });
}

module.exports = {
  getGoogleLoginConfig,
  registerCustomerGoogleAuthRoutes,
  safeGoogleNextPath,
  signGoogleState,
  verifyGoogleState,
};
