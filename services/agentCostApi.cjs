'use strict';

// Rotas do agente de custo (OpenBot no servidor de casa).
// O agente lê no Bling (pela tela, com a sessão do dono) o último lançamento de entrada e grava aqui.
// - acesso só com a chave MDV_AGENT_KEY no cabeçalho x-agent-key (sem a variável, as rotas ficam desligadas);
// - GET  /agent/cost/pending?limit=N&after=<cursor> : produtos ativos sem custo, com SKU e vínculo Bling, sem IMEI, fora de celular/tablet;
// - POST /agent/cost/:id     : grava pelo mesmo serviço do custo manual do admin (histórico + evidência + concorrência).

const crypto = require('node:crypto');

const DEVICE_CATEGORY = /smartphone|celular|tablet|ipad/i;
const isDeviceCategory = (name) => DEVICE_CATEGORY.test(String(name || ''));

class AgentCostError extends Error {
  constructor(statusCode, code, message) { super(message); this.statusCode = statusCode; this.code = code; }
}

function parseJson(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v) || {}; } catch { return {}; }
}

function createAgentCostApi({ pool, manualCost, key = process.env.MDV_AGENT_KEY }) {
  const expected = Buffer.from(String(key || ''));

  function authorize(headers = {}) {
    if (expected.length < 32) return false;
    const got = Buffer.from(String(headers['x-agent-key'] || ''));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  }

  function readCursor(after) {
    if (!after) return null;
    try {
      const c = JSON.parse(Buffer.from(String(after), 'base64url').toString('utf8'));
      if (c && typeof c.name === 'string' && typeof c.id === 'string') return c;
    } catch {}
    throw new AgentCostError(400, 'invalid_cursor', 'Cursor inválido.');
  }
  const makeCursor = (row) => Buffer.from(JSON.stringify({ name: String(row.name ?? ''), id: String(row.id) })).toString('base64url');

  // Cascata: ordem por nome+id; o cursor "after" continua de onde parou (pulados e gravados não voltam).
  async function pending(query = {}) {
    const n = Number.parseInt(query.limit, 10);
    const limit = Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 10;
    const cursor = readCursor(query.after);
    const fetchSize = limit * 4;
    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.bling_id, p.price_cost, p.custom_fields,
              (SELECT c.name FROM categories c WHERE c.id = p.category_id LIMIT 1) AS category_name
         FROM products p
        WHERE p.status = 'active'
          AND (p.is_parent = 0 OR p.is_parent IS NULL)
          AND p.sku IS NOT NULL AND p.sku <> ''
          AND p.bling_id IS NOT NULL AND p.bling_id <> ''
          AND (p.price_cost IS NULL OR p.price_cost = 0)
          AND NOT EXISTS (SELECT 1 FROM units u WHERE u.product_id = p.id)
          ${cursor ? 'AND (p.name > ? OR (p.name = ? AND p.id > ?))' : ''}
        ORDER BY p.name, p.id
        LIMIT ?`,
      cursor ? [cursor.name, cursor.name, cursor.id, fetchSize] : [fetchSize],
    );
    const list = rows || [];
    const products = [];
    let last = null;
    for (const p of list) {
      last = p;
      if (isDeviceCategory(p.category_name) || parseJson(p.custom_fields).inherit_parent_cost === true) continue;
      products.push({ id: p.id, sku: p.sku, name: p.name, bling_id: String(p.bling_id), price_cost: p.price_cost == null ? null : Number(p.price_cost), category: p.category_name || null });
      if (products.length === limit) break;
    }
    const more = products.length === limit ? last !== list[list.length - 1] || list.length === fetchSize : list.length === fetchSize;
    return { products, next: more && last ? makeCursor(last) : null };
  }

  async function save(productId, body = {}) {
    const [rows] = await pool.query(
      `SELECT p.id, (SELECT c.name FROM categories c WHERE c.id = p.category_id LIMIT 1) AS category_name
         FROM products p WHERE p.id = ? LIMIT 1`,
      [String(productId || '')],
    );
    const p = rows?.[0];
    if (!p) throw new AgentCostError(404, 'product_not_found', 'Produto não encontrado.');
    if (isDeviceCategory(p.category_name)) throw new AgentCostError(409, 'device_category', 'Celular/tablet: o custo vem do MdV, o agente não mexe.');
    const note = `Agente OpenBot: ${String(body.note || 'custo do Bling').trim()}`.slice(0, 300);
    return manualCost.updateCost(p.id, { cost_cents: body.cost_cents, expected_cost_cents: body.expected_cost_cents, note }, { customerId: null, context: 'agente_openbot' });
  }

  return { authorize, pending, save };
}

function registerAgentCostRoutes(fastify, { pool, manualCost }) {
  const api = createAgentCostApi({ pool, manualCost });
  const guard = async (request, reply) => {
    if (!api.authorize(request.headers)) return reply.code(401).send({ error: 'Agent key required' });
  };
  const fail = (reply, error) => {
    if (error?.statusCode) return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    console.error('[agent-cost]', error?.message || error);
    return reply.code(500).send({ error: 'Falha no agente de custo.' });
  };
  fastify.get('/agent/cost/pending', { preHandler: guard }, async (request, reply) => {
    try { reply.header('Cache-Control', 'no-store'); return await api.pending(request.query || {}); } catch (e) { return fail(reply, e); }
  });
  fastify.post('/agent/cost/:id', { preHandler: guard }, async (request, reply) => {
    try { reply.header('Cache-Control', 'no-store'); return await api.save(request.params?.id, request.body || {}); } catch (e) { return fail(reply, e); }
  });
}

module.exports = { createAgentCostApi, registerAgentCostRoutes, isDeviceCategory, AgentCostError };
