'use strict';

const crypto = require('node:crypto');
const WINDOW = 15 * 60 * 1000;
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function createStorefrontAuthSecurity({ pool, secret, turnstileSecret, publicUrl, fetchImpl = fetch, now = Date.now, scope = 'loja_3d' }) {
  if (!['loja_3d', 'mercado_do_vale'].includes(scope)) throw new Error('Invalid auth security scope');
  const table = scope === 'loja_3d' ? 'print3d_login_limits' : 'customer_login_limits';
  const action = scope === 'loja_3d' ? 'print3d_auth' : 'mdv_auth';
  const keyPrefix = scope === 'loja_3d' ? 'print3d_login' : 'mdv_login';
  let hostname;
  try { hostname = new URL(publicUrl).hostname; } catch { /* Disabled until configured. */ }
  const configured = Boolean(hostname && typeof secret === 'string' && secret.length >= 32
    && typeof turnstileSecret === 'string' && turnstileSecret.trim());
  const key = value => crypto.createHmac('sha256', secret).update(`${keyPrefix}:${value}`).digest('hex');

  async function verifyCaptcha(token) {
    if (!configured) throw fail(503, 'Verificação de segurança indisponível. Tente novamente mais tarde.');
    if (typeof token !== 'string' || !token || token.length > 2048) throw fail(400, 'Confirme a verificação de segurança.');
    let result;
    try {
      const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: token }), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Provider unavailable');
      result = await response.json();
    } catch { throw fail(503, 'Verificação de segurança indisponível. Tente novamente mais tarde.'); }
    if (result?.success !== true || result.hostname !== hostname || result.action !== action) {
      throw fail(400, 'Verificação de segurança inválida ou expirada. Tente novamente.');
    }
  }

  // Both rows stay locked while checking the password, so concurrent requests
  // cannot all slip through immediately before the fifth failed attempt.
  async function login({ accountId, identifier, ip, check }) {
    const buckets = [
      { key: key(accountId ? `account:${accountId}` : `unknown:${identifier}`), max: 5, account: true },
      { key: key(`ip:${ip || 'unknown'}`), max: 30, account: false },
    ].sort((a, b) => a.key.localeCompare(b.key));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const bucket of buckets) {
        await connection.query(`INSERT INTO ${table} (bucket_key, failures, window_start, blocked_until)
          VALUES (?, 0, 0, 0) ON DUPLICATE KEY UPDATE bucket_key = bucket_key`, [bucket.key]);
        const [rows] = await connection.query(`SELECT failures, window_start, blocked_until FROM ${table} WHERE bucket_key = ? FOR UPDATE`, [bucket.key]);
        bucket.state = rows[0];
      }
      const at = now();
      const blocked = buckets.some(b => Number(b.state.blocked_until) > at);
      if (blocked) {
        await connection.rollback();
        return { blocked: true, valid: false };
      }
      const valid = await check();
      for (const bucket of buckets) {
        const old = bucket.state;
        const expired = at - Number(old.window_start) >= WINDOW;
        const failures = valid ? (bucket.account || expired ? 0 : Number(old.failures)) : (expired ? 1 : Number(old.failures) + 1);
        const start = expired || (valid && bucket.account) ? at : Number(old.window_start);
        const until = !valid && failures >= bucket.max ? at + WINDOW : 0;
        await connection.query(`UPDATE ${table} SET failures = ?, window_start = ?, blocked_until = ? WHERE bucket_key = ?`, [failures, start, until, bucket.key]);
      }
      await connection.commit();
      return { valid, blocked: false };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  // Called in the password-reset transaction after proving ownership.
  async function clearAccount(connection, accountId) {
    await connection.query(`DELETE FROM ${table} WHERE bucket_key = ?`, [key(`account:${accountId}`)]);
  }
  return { configured, verifyCaptcha, login, clearAccount };
}
module.exports = { createStorefrontAuthSecurity };
