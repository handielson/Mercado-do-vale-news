'use strict';

const crypto = require('node:crypto');

const PURPOSE = 'loja_3d_customer_session_v1';
const AUDIENCE = 'loja_3d';
const TTL_SECONDS = 60 * 60 * 24 * 7;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function signingKey(masterSecret) {
  if (typeof masterSecret !== 'string' || masterSecret.length < 32) throw new Error('Segredo de autenticação indisponível.');
  return crypto.createHmac('sha256', masterSecret).update(PURPOSE).digest();
}

function signPrint3dCustomerSession(customerId, masterSecret, nowSeconds = Math.floor(Date.now() / 1000), authVersion = 1) {
  if (typeof customerId !== 'string' || !UUID.test(customerId)) {
    throw new Error('Conta 3D inválida.');
  }
  if (!Number.isSafeInteger(authVersion) || authVersion < 1) throw new Error('Versão de autenticação inválida.');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: customerId, aud: AUDIENCE, v: authVersion, iat: nowSeconds,
    exp: nowSeconds + TTL_SECONDS })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', signingKey(masterSecret)).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyPrint3dCustomerSession(token, masterSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some(part => !part)) return null;
    const [header, payload, signature] = parts;
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
    const expected = crypto.createHmac('sha256', signingKey(masterSecret))
      .update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.aud !== AUDIENCE || typeof claims.sub !== 'string' || !UUID.test(claims.sub)) return null;
    if (!Number.isSafeInteger(claims.v) || claims.v < 1) return null;
    if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || claims.iat > nowSeconds || claims.exp <= nowSeconds || claims.exp - claims.iat !== TTL_SECONDS) return null;
    return { customer_id: claims.sub, storefront: AUDIENCE, auth_version: claims.v };
  } catch { return null; }
}

module.exports = { signPrint3dCustomerSession, verifyPrint3dCustomerSession };
