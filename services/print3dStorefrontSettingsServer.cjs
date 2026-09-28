'use strict';

const DEFAULT_MESSAGE = 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.';

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

function registerPrint3dStorefrontSettingsRoutes(app, { pool, getBearerAuthContext }) {
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
  registerPrint3dStorefrontSettingsRoutes,
};
