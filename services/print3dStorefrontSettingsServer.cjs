'use strict';

const crypto = require('node:crypto');

const DEFAULT_MESSAGE = 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.';
const PREVIEW_AUDIENCE = 'print3d_maintenance_preview';
const PREVIEW_TTL_SECONDS = 2 * 60 * 60;

function previewSigningKey(secret) {
  if (!secret) throw new Error('Segredo da prévia administrativa não configurado.');
  return crypto.createHmac('sha256', String(secret)).update('3dmv-maintenance-preview:v1').digest();
}

function createMaintenancePreviewToken(secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = {
    aud: PREVIEW_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + PREVIEW_TTL_SECONDS,
    nonce: crypto.randomBytes(12).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', previewSigningKey(secret)).update(body).digest('base64url');
  return { token: `${body}.${signature}`, expires_at: new Date(payload.exp * 1000).toISOString() };
}

function verifyMaintenancePreviewToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const [body, suppliedSignature, extra] = String(token || '').split('.');
    if (!body || !suppliedSignature || extra) return null;
    const expectedSignature = crypto.createHmac('sha256', previewSigningKey(secret)).update(body).digest();
    const suppliedBuffer = Buffer.from(suppliedSignature, 'base64url');
    if (expectedSignature.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedSignature, suppliedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.aud !== PREVIEW_AUDIENCE || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds || payload.exp - payload.iat !== PREVIEW_TTL_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

async function ensurePrint3dStorefrontSettingsTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS print3d_storefront_settings (
    id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
    maintenance_message VARCHAR(500) NOT NULL DEFAULT '${DEFAULT_MESSAGE.replace(/'/g, "''")}',
    updated_by CHAR(36) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(
    `INSERT IGNORE INTO print3d_storefront_settings (id, maintenance_mode, maintenance_message)
     VALUES (1, 0, ?)`,
    [DEFAULT_MESSAGE],
  );
}

function present(row) {
  return {
    storefront: 'loja_3d',
    maintenance_mode: Boolean(Number(row?.maintenance_mode || 0)),
    maintenance_message: String(row?.maintenance_message || DEFAULT_MESSAGE),
    updated_at: row?.updated_at || null,
  };
}

function validateInput(body = {}) {
  if (typeof body.maintenance_mode !== 'boolean') {
    throw Object.assign(new Error('Informe se a manutenção está ativada.'), { statusCode: 400 });
  }
  const message = String(body.maintenance_message || '').trim();
  if (message.length < 10 || message.length > 500) {
    throw Object.assign(new Error('A mensagem deve ter entre 10 e 500 caracteres.'), { statusCode: 400 });
  }
  return { maintenance_mode: body.maintenance_mode, maintenance_message: message };
}

function registerPrint3dStorefrontSettingsRoutes(app, { pool, getBearerAuthContext, authSecret, publicOrigin = 'https://www.3dmv.com.br' }) {
  let ready;
  const ensure = () => (ready ||= ensurePrint3dStorefrontSettingsTable(pool));
  const admin = async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(request);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    request.print3dSettingsAdminId = auth.userId;
  };

  app.get('/storefronts/loja_3d/settings', async (_request, reply) => {
    await ensure();
    const [rows] = await pool.query('SELECT maintenance_mode, maintenance_message, updated_at FROM print3d_storefront_settings WHERE id = 1 LIMIT 1');
    reply.header('Cache-Control', 'no-store');
    return present(rows[0]);
  });

  app.get('/admin/print3d/settings', { preHandler: admin }, async (_request, reply) => {
    await ensure();
    const [rows] = await pool.query('SELECT maintenance_mode, maintenance_message, updated_at FROM print3d_storefront_settings WHERE id = 1 LIMIT 1');
    reply.header('Cache-Control', 'no-store');
    return present(rows[0]);
  });

  app.post('/admin/print3d/settings/preview', { preHandler: admin }, async (_request, reply) => {
    try {
      const preview = createMaintenancePreviewToken(authSecret);
      const origin = String(publicOrigin || 'https://www.3dmv.com.br').replace(/\/$/, '');
      reply.header('Cache-Control', 'no-store');
      return { ...preview, preview_url: `${origin}/loja-3d?maintenance_preview=${encodeURIComponent(preview.token)}` };
    } catch (error) {
      return reply.code(503).send({ error: error?.message || 'Prévia administrativa indisponível.' });
    }
  });

  app.post('/storefronts/loja_3d/maintenance-preview/verify', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const payload = verifyMaintenancePreviewToken(request.body?.token, authSecret);
    reply.header('Cache-Control', 'no-store');
    if (!payload) return reply.code(401).send({ valid: false, error: 'Prévia inválida ou expirada.' });
    return { valid: true, expires_at: new Date(payload.exp * 1000).toISOString() };
  });

  app.put('/admin/print3d/settings', { preHandler: admin }, async (request, reply) => {
    try {
      const input = validateInput(request.body);
      await ensure();
      await pool.query(
        `UPDATE print3d_storefront_settings
         SET maintenance_mode = ?, maintenance_message = ?, updated_by = ?
         WHERE id = 1`,
        [input.maintenance_mode ? 1 : 0, input.maintenance_message, request.print3dSettingsAdminId],
      );
      const [rows] = await pool.query('SELECT maintenance_mode, maintenance_message, updated_at FROM print3d_storefront_settings WHERE id = 1 LIMIT 1');
      reply.header('Cache-Control', 'no-store');
      return { ok: true, ...present(rows[0]) };
    } catch (error) {
      if (error?.statusCode === 400) return reply.code(400).send({ error: error.message });
      request.log?.error({ err: error }, 'print3d-storefront-settings-update');
      return reply.code(500).send({ error: 'Não foi possível atualizar a manutenção da 3DMV.' });
    }
  });
}

module.exports = {
  DEFAULT_MESSAGE,
  ensurePrint3dStorefrontSettingsTable,
  present,
  validateInput,
  createMaintenancePreviewToken,
  verifyMaintenancePreviewToken,
  registerPrint3dStorefrontSettingsRoutes,
};
