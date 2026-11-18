'use strict';
const { buildUnitTimeline } = require('./unitTimeline.cjs');

// Leitor admin da página do aparelho. Só lê; nada aqui grava no banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIT_FIELDS = ['id', 'product_id', 'imei', 'imei_1', 'imei_2', 'serial', 'condition', 'status', 'cost_price',
  'created_at', 'updated_at', 'sold_at', 'reserved_at', 'sale_id', 'order_id', 'deposit_id', 'location_id', 'intake_id'];
const parse = v => { if (typeof v !== 'string') return v ?? null; try { return JSON.parse(v); } catch { return null; } };
const uniq = list => [...new Set(list.filter(Boolean).map(String))];

function registerUnitTimelineRoutes(app, { pool, getBearerAuthContext }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
  };
  const rows = async (sql, params) => (await pool.query(sql, params))[0] || [];
  const inList = async (sql, ids) => (ids.length ? rows(sql, [ids]) : []);

  async function timelineFor(unit) {
    const [product] = await rows('SELECT id, name, sku, price_retail, images, image_url FROM products WHERE id = ? LIMIT 1', [unit.product_id]);
    const journal = (await rows(
      `SELECT CAST(id AS CHAR) id, unit_id, product_id, event_type,
        DATE_FORMAT(recorded_at,'%Y-%m-%dT%H:%i:%s.%fZ') recorded_at, before_data, after_data
       FROM unit_journal_events WHERE unit_id = ? ORDER BY id LIMIT 2000`, [unit.id]))
      .map(r => ({ ...r, before_data: parse(r.before_data), after_data: parse(r.after_data) }));
    const ownItems = await rows('SELECT * FROM sale_items WHERE serialized_unit_id = ?', [unit.id]);
    const saleIds = uniq([
      unit.sale_id, ...ownItems.map(i => i.sale_id),
      ...journal.flatMap(j => [j.after_data?.sale?.id, j.before_data?.sale?.id, j.after_data?.sale_items?.sale_id, j.after_data?.unit?.sale_id]),
    ]);
    const sales = (await inList('SELECT * FROM sales WHERE id IN (?)', saleIds)).map(({ finalization_log, ...s }) => s);
    const saleItems = await inList('SELECT * FROM sale_items WHERE sale_id IN (?)', saleIds);
    const customers = await inList('SELECT id, name FROM customers WHERE id IN (?)', uniq(sales.map(s => s.customer_id)));
    // Vendedor = usuário de login; o nome dele está no cadastro de cliente ligado à conta.
    const sellerIds = uniq(sales.map(s => s.seller_id));
    const sellerRows = sellerIds.length
      ? await rows('SELECT id, name, auth_user_id, user_id FROM customers WHERE auth_user_id IN (?) OR user_id IN (?)', [sellerIds, sellerIds]) : [];
    const teamMembers = sellerIds.map(id => {
      const match = sellerRows.find(c => String(c.auth_user_id || '') === id || String(c.user_id || '') === id);
      return match ? { id, name: match.name } : null;
    }).filter(Boolean);
    const intakes = unit.intake_id ? await rows('SELECT id, created_at, created_by, status FROM smartphone_photo_intakes WHERE id = ? LIMIT 1', [unit.intake_id]) : [];
    const warranties = await rows('SELECT id, sale_id, serialized_unit_id, created_at FROM warranty_documents WHERE serialized_unit_id = ?', [unit.id]);
    const signedWarranties = await inList('SELECT id, sale_id, status, created_at FROM signed_warranty_documents WHERE sale_id IN (?)', saleIds);
    const deposits = unit.deposit_id ? await rows('SELECT id, name FROM stock_deposits WHERE id = ? LIMIT 1', [unit.deposit_id]) : [];
    const locations = unit.location_id ? await rows('SELECT id, name, deposit_id FROM stock_locations WHERE id = ? LIMIT 1', [unit.location_id]) : [];

    const { current, events } = buildUnitTimeline({ unit, product, journal, sales, saleItems, customers, teamMembers, intakes, warranties, signedWarranties, deposits, locations });
    const images = parse(product?.images);
    return {
      unit: Object.fromEntries(UNIT_FIELDS.filter(k => k in unit).map(k => [k, unit[k] ?? null])),
      product: product ? { id: product.id, name: product.name, sku: product.sku, image_url: product.image_url || (Array.isArray(images) ? images.find(Boolean) : null) || null } : null,
      current, events,
    };
  }

  const notFound = reply => reply.code(404).send({ error: 'Aparelho não encontrado.' });

  app.get('/admin/units/:unitId/timeline', { preHandler: admin }, async (req, reply) => {
    const unitId = String(req.params?.unitId || '');
    if (!UUID.test(unitId)) return reply.code(400).send({ error: 'Informe um identificador de unidade válido.' });
    const [unit] = await rows('SELECT * FROM units WHERE id = ? LIMIT 1', [unitId]);
    return unit ? timelineFor(unit) : notFound(reply);
  });

  app.get('/admin/units/timeline', { preHandler: admin }, async (req, reply) => {
    const identifier = String(req.query?.identifier || '').trim();
    if (!identifier || identifier.length > 100) return reply.code(400).send({ error: 'Informe um IMEI, serial ou identificador de unidade válido.' });
    const found = await rows('SELECT * FROM units WHERE id = ? OR imei = ? OR imei_1 = ? OR imei_2 = ? OR serial = ? LIMIT 20', Array(5).fill(identifier));
    if (!found.length) return notFound(reply);
    if (found.length === 1) return timelineFor(found[0]);
    const names = new Map((await inList('SELECT id, name FROM products WHERE id IN (?)', uniq(found.map(u => u.product_id)))).map(p => [String(p.id), p.name]));
    return {
      matches: found.map(u => ({ id: u.id, productName: names.get(String(u.product_id)) || null, imei1: u.imei_1 || u.imei || null, imei2: u.imei_2 || null, serial: u.serial || null, status: u.status })),
    };
  });
}

module.exports = { registerUnitTimelineRoutes };
