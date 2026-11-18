'use strict';
const defaults = require('./unitLocation.cjs');

// Rotas do local do aparelho: transferir por IMEI, conferência de saldo sem IMEI e preenchimento inicial.
function registerUnitLocationRoutes(app, deps) {
  const { pool, getBearerAuthContext, requireSyncKey, syncProductStock, ensureIncomingStockLocation, getDefaultStockCompanyId } = deps;
  const impl = { ...defaults, ...(deps.impl || {}) };

  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.unitLocationAuth = auth;
  };
  const actorOf = async auth => {
    let name = null;
    if (auth?.customerId) {
      try { const [rows] = await pool.query('SELECT name FROM customers WHERE id = ? LIMIT 1', [auth.customerId]); name = rows?.[0]?.name || null; }
      catch { /* nome é informativo */ }
    }
    return { userId: auth?.userId || null, name };
  };
  const send = (reply, error) => {
    if (!error.statusCode) throw error;
    return reply.code(error.statusCode).send({ error: error.message });
  };

  app.post('/admin/units/transfers', { preHandler: admin }, async (req, reply) => {
    const body = req.body || {};
    const conn = await pool.getConnection();
    try {
      return await impl.transferUnits({
        db: conn, identifiers: body.identifiers, toDepositId: body.to_deposit_id, toLocationId: body.to_location_id,
        companyId: await getDefaultStockCompanyId(),
        reason: body.reason ? String(body.reason).trim() : null, actor: await actorOf(req.unitLocationAuth), syncProductStock,
      });
    } catch (error) { return send(reply, error); }
    finally { conn.release(); }
  });

  app.get('/admin/units/stock-mismatches', { preHandler: admin }, async () => ({ rows: await impl.stockMismatches(pool) }));

  app.post('/admin/units/location-backfill', { preHandler: requireSyncKey }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    // Por padrão só mostra o que faria; grava apenas com ?apply=1.
    const apply = ['1', 'true'].includes(String(req.query?.apply || ''));
    const incoming = await ensureIncomingStockLocation(await getDefaultStockCompanyId());
    const conn = await pool.getConnection();
    try {
      return await impl.backfillUnitLocations({
        db: conn, incoming: { depositId: incoming.depositId, locationId: incoming.locationId }, apply,
        actor: { userId: null, name: 'Implantação do local do aparelho' }, syncProductStock,
      });
    } catch (error) { return send(reply, error); }
    finally { conn.release(); }
  });
}

async function ensureUnitEventsTable(db) {
  await db.query(defaults.unitEventsMigration()[0].sql);
}

module.exports = { registerUnitLocationRoutes, ensureUnitEventsTable };
