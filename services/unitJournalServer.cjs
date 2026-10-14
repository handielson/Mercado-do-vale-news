'use strict';
const { TABLE } = require('./unitJournalSchema.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function registerUnitJournalRoutes(app, { pool, getBearerAuthContext }) {
  // Generic table endpoints must not bypass the dedicated admin-only reader.
  app.addHook('onRequest', async (req, reply) => {
    const path = decodeURIComponent(String(req.url || '').split('?')[0]);
    if (new RegExp(`^/table-data/${TABLE}(?:/|$)`, 'i').test(path)) {
      return reply.code(403).send({ error: 'O diário só pode ser consultado pelo leitor administrativo.' });
    }
  });
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
  };
  const read = async (req, reply) => {
    const unitId = req.params?.unitId;
    const productId = req.params?.productId;
    const productIds = [...new Set([productId, ...String(req.query?.include || '').split(',')].filter(Boolean))];
    const identifier = String(req.query?.identifier || '').trim();
    if (productId ? productIds.length > 100 || productIds.some(id => !UUID.test(id)) : unitId ? !UUID.test(unitId) : !identifier || identifier.length > 100) {
      return reply.code(400).send({ error: 'Informe um IMEI, serial ou identificador de unidade válido.' });
    }
    const cursor = String(req.query?.before || '');
    if (cursor && !/^[1-9]\d{0,19}$/.test(cursor)) return reply.code(400).send({ error: 'Página inválida.' });
    const slots = productIds.map(() => '?').join(',');
    const where = productId ? `(e.product_id IN (${slots}) OR e.product_id IN (SELECT id FROM products WHERE parent_id IN (${slots}))
      OR JSON_UNQUOTE(JSON_EXTRACT(e.before_data,'$.product.id')) IN (${slots})
      OR JSON_UNQUOTE(JSON_EXTRACT(e.before_data,'$.product.parent_id')) IN (${slots})
      OR JSON_UNQUOTE(JSON_EXTRACT(e.after_data,'$.product.parent_id')) IN (${slots}))` : unitId ? 'e.unit_id=?' : `EXISTS (SELECT 1 FROM ${TABLE} matched WHERE matched.unit_id=e.unit_id AND (
      matched.imei_1_before=? OR matched.imei_1_after=? OR matched.imei_2_before=? OR matched.imei_2_after=? OR
      matched.serial_before=? OR matched.serial_after=?))`;
    const params = productId ? Array.from({ length: 5 }, () => productIds).flat() : unitId ? [unitId] : Array(6).fill(identifier);
    if (cursor) params.push(cursor);
    try {
      const [rows] = await pool.query(`SELECT CAST(e.id AS CHAR) id,e.unit_id,e.product_id,e.event_type,
        DATE_FORMAT(e.recorded_at,'%Y-%m-%dT%H:%i:%s.%fZ') recorded_at,e.db_actor,e.before_data,e.after_data
        FROM ${TABLE} e WHERE ${where}${cursor ? ' AND e.id<?' : ''} ORDER BY e.id DESC LIMIT 101`, params);
      const events = rows.slice(0, 100).map(row => ({ ...row,
        before_data: typeof row.before_data === 'string' ? JSON.parse(row.before_data) : row.before_data,
        after_data: typeof row.after_data === 'string' ? JSON.parse(row.after_data) : row.after_data,
      }));
      return { events, next: rows.length > 100 ? String(events.at(-1).id) : null };
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') return reply.code(503).send({ error: 'O diário ainda precisa ser instalado no banco.' });
      throw error;
    }
  };
  app.get('/admin/units/:unitId/journal', { preHandler: admin }, read);
  app.get('/admin/units/journal', { preHandler: admin }, read);
  app.get('/admin/products/:productId/journal', { preHandler: admin }, read);
}
module.exports = { registerUnitJournalRoutes };
