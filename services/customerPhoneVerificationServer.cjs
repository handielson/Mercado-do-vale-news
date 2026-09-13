const crypto = require('node:crypto');
const { isIP } = require('node:net');

function verificationClientIp(request) {
  const peer = request.raw?.socket?.remoteAddress || request.ip || '';
  if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) {
    // Nginx local acrescenta o peer real no último campo; ignora os campos fornecidos pelo visitante.
    const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',').pop().trim();
    if (isIP(forwarded)) return forwarded;
  }
  return peer;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const DDD = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
function verificationError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
function normalizeVerificationPhone(value) {
  const raw = String(value || '');
  if (/[^\d\s()+.-]/u.test(raw)) return '';
  let digits = raw.replace(/\D/g, '');
  if ([12, 13].includes(digits.length) && digits.startsWith('55')) digits = digits.slice(2);
  if (!DDD.has(digits.slice(0, 2))) return '';
  const local = digits.slice(2);
  if (!/^(?:9\d{8}|[2-5]\d{7})$/.test(local) || /^(\d)\1+$/.test(local)) return '';
  return '55' + digits;
}
function pendingPhoneVerification(customer) {
  let data = customer?.custom_data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return data?.whatsapp_verification_required === true;
}

// A prova é opaca, ligada ao telefone e ao propósito, consumida na transação do cadastro.
function createCustomerPhoneVerification({ pool, secret, send, getAuth, now = Date.now }) {
  const hash = (value) => crypto.createHmac('sha256', secret).update(value).digest('hex');
  let ready;
  async function ensure() {
    if (!ready) ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS customer_phone_verifications (
        phone VARCHAR(13) NOT NULL PRIMARY KEY,
        challenge_id VARCHAR(64) NOT NULL UNIQUE,
        owner_key VARCHAR(100) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at BIGINT NOT NULL,
        sent TINYINT NOT NULL DEFAULT 0,
        proof_hash CHAR(64) NULL,
        proof_expires_at BIGINT NULL,
        consumed TINYINT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB`);
      await pool.query(`CREATE TABLE IF NOT EXISTS customer_phone_verification_limits (
        bucket_key CHAR(64) NOT NULL PRIMARY KEY,
        window_start BIGINT NOT NULL,
        last_request BIGINT NOT NULL,
        requests INT NOT NULL
      ) ENGINE=InnoDB`);
    })().catch((error) => { ready = null; throw error; });
    return ready;
  }
  async function transaction(work) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  async function owner(request) {
    if (request.body?.purpose === 'registration') return 'registration';
    if (request.body?.purpose !== 'profile') throw verificationError('Finalidade de confirmação inválida');
    const auth = await getAuth(request);
    if (!auth.customerId) throw verificationError('Entre na sua conta para confirmar o telefone', 401);
    return 'profile:' + auth.customerId;
  }
  async function limit(connection, key, max, cooldown) {
    const at = now();
    await connection.query(
      'INSERT IGNORE INTO customer_phone_verification_limits (bucket_key, window_start, last_request, requests) VALUES (?, ?, 0, 0)',
      [key, at]);
    const [[row]] = await connection.query(
      'SELECT * FROM customer_phone_verification_limits WHERE bucket_key = ? FOR UPDATE', [key]);
    const fresh = at - Number(row.window_start) >= 3600000;
    const count = fresh ? 0 : Number(row.requests);
    if (count >= max || (row.last_request && at - Number(row.last_request) < cooldown)) {
      throw verificationError('Aguarde antes de pedir outro código. Há um limite de envios por hora.', 429);
    }
    await connection.query(
      'UPDATE customer_phone_verification_limits SET window_start = ?, last_request = ?, requests = ? WHERE bucket_key = ?',
      [fresh ? at : row.window_start, at, count + 1, key]);
  }
  async function requestCode(request) {
    const phone = normalizeVerificationPhone(request.body?.phone);
    if (!phone) throw verificationError('Informe um telefone válido com DDD e WhatsApp');
    const ownerKey = await owner(request);
    await ensure();
    const challenge = crypto.randomBytes(24).toString('hex');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await transaction(async (connection) => {
      // IP obtido pelo servidor; nunca aceitar IP informado no corpo ou x-forwarded-for arbitrário.
      await limit(connection, hash('ip:' + verificationClientIp(request)), 10, 0);
      await limit(connection, hash('phone:' + phone), 5, 60000);
      await connection.query(
        `INSERT INTO customer_phone_verifications
         (phone, challenge_id, owner_key, code_hash, attempts, expires_at, sent, proof_hash, proof_expires_at, consumed)
         VALUES (?, ?, ?, ?, 0, ?, 0, NULL, NULL, 0)
         ON DUPLICATE KEY UPDATE challenge_id = VALUES(challenge_id), owner_key = VALUES(owner_key),
         code_hash = VALUES(code_hash), attempts = 0, expires_at = VALUES(expires_at), sent = 0,
         proof_hash = NULL, proof_expires_at = NULL, consumed = 0`,
        [phone, challenge, ownerKey, hash(challenge + ':' + code), now() + TTL_MS]);
    });
    let result;
    try {
      result = await send(phone, [
        'Mercado do Vale 🔐',
        'Seu código para confirmar este WhatsApp é: ' + code,
        'Válido por 10 minutos. Digite o código somente no site do Mercado do Vale.',
        'Não compartilhe este código. Se não foi você, ignore esta mensagem.',
      ].join('\n'));
    } catch { result = null; }
    if (!result?.ok) {
      await pool.query('UPDATE customer_phone_verifications SET consumed = 1 WHERE challenge_id = ?', [challenge]);
      throw verificationError('Não foi possível enviar o código. Confira se o número tem WhatsApp e tente novamente em um minuto.', 503);
    }
    await pool.query('UPDATE customer_phone_verifications SET sent = 1 WHERE challenge_id = ?', [challenge]);
    return { challenge_id: challenge, expires_in: TTL_MS / 1000, retry_after: 60 };
  }
  async function verifyCode(request) {
    const challenge = String(request.body?.challenge_id || '');
    const code = String(request.body?.code || '');
    if (!/^[a-f0-9]{48}$/.test(challenge) || !/^\d{6}$/.test(code)) {
      throw verificationError('Digite o código de seis dígitos recebido no WhatsApp');
    }
    const ownerKey = await owner(request);
    await ensure();
    const result = await transaction(async (connection) => {
      const [[row]] = await connection.query(
        'SELECT * FROM customer_phone_verifications WHERE challenge_id = ? FOR UPDATE', [challenge]);
      if (!row || row.owner_key !== ownerKey || !row.sent || row.consumed || row.proof_hash
        || Number(row.expires_at) <= now() || Number(row.attempts) >= MAX_ATTEMPTS) return null;
      const expected = Buffer.from(row.code_hash, 'hex');
      const actual = Buffer.from(hash(challenge + ':' + code), 'hex');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        await connection.query('UPDATE customer_phone_verifications SET attempts = attempts + 1 WHERE challenge_id = ?', [challenge]);
        return null;
      }
      const proof = crypto.randomBytes(32).toString('hex');
      await connection.query(
        'UPDATE customer_phone_verifications SET proof_hash = ?, proof_expires_at = ? WHERE challenge_id = ?',
        [hash(proof), now() + TTL_MS, challenge]);
      return { phone_verification_token: proof, expires_in: TTL_MS / 1000 };
    });
    if (!result) throw verificationError('Código inválido, expirado ou já utilizado. Confira ou solicite outro código.');
    return result;
  }
  async function consume(connection, token, phone, ownerKey) {
    if (!/^[a-f0-9]{64}$/.test(String(token || ''))) {
      throw verificationError('Confirme seu número pelo código enviado no WhatsApp');
    }
    const canonical = normalizeVerificationPhone(phone);
    const [[row]] = await connection.query(
      'SELECT * FROM customer_phone_verifications WHERE phone = ? FOR UPDATE', [canonical]);
    if (!row || row.owner_key !== ownerKey || row.consumed || !row.sent || !row.proof_hash
      || Number(row.proof_expires_at) <= now() || row.proof_hash !== hash(token)) {
      throw verificationError('Confirmação do WhatsApp inválida ou expirada. Confirme o número novamente.');
    }
    await connection.query('UPDATE customer_phone_verifications SET consumed = 1 WHERE phone = ?', [canonical]);
  }
  function register(fastify) {
    fastify.post('/auth/phone/request', { config: { rateLimit: { max: 10, timeWindow: '1 hour', keyGenerator: verificationClientIp } } }, requestCode);
    fastify.post('/auth/phone/verify', { config: { rateLimit: { max: 30, timeWindow: '10 minutes', keyGenerator: verificationClientIp } } }, verifyCode);
  }
  return { ensure, consume, register, requestCode, verifyCode };
}
module.exports = { createCustomerPhoneVerification, normalizeVerificationPhone, pendingPhoneVerification, verificationClientIp };
