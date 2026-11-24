'use strict';

// bot-focus-product-v1 (24/11/2026): "celular em foco" do robô — um produto por vez, escolhido pela estrela no card
// do produto no painel. A lista de produtos que o robô consulta (GET /products) marca esse produto com bot_focus:true
// (e as variações dele, quando a estrela foi num produto pai); o n8n fecha a lista de celulares indicando esse aparelho.
const KEY = 'bot.focus_product.v1';

function createBotFocusProduct({ pool, now = () => Date.now(), ttlMs = 15_000 }) {
  let cache = null;
  async function get() {
    if (cache && now() - cache.at < ttlMs) return cache.value;
    const [rows] = await pool.query('SELECT value_json FROM admin_preferences WHERE preference_key = ? LIMIT 1', [KEY]);
    let value = null;
    try { value = rows?.[0]?.value_json ? (typeof rows[0].value_json === 'string' ? JSON.parse(rows[0].value_json) : rows[0].value_json) : null; } catch { value = null; }
    cache = { at: now(), value: value?.product_id ? value : null };
    return cache.value;
  }
  async function set(productId, actor) {
    const id = productId ? String(productId).trim() : '';
    let value = null;
    if (id) {
      const [[p]] = await pool.query('SELECT id, name, sku, status FROM products WHERE id = ? LIMIT 1', [id]);
      if (!p) throw Object.assign(new Error('Produto não encontrado.'), { statusCode: 404 });
      value = { product_id: String(p.id), name: p.name, sku: p.sku, set_at: new Date(now()).toISOString(), set_by: actor || null };
    }
    await pool.query(`INSERT INTO admin_preferences (preference_key, value_json) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`, [KEY, JSON.stringify(value || {})]);
    cache = { at: now(), value };
    return value;
  }
  // Marca as linhas da lista de produtos (o próprio produto ou as variações do produto pai em foco).
  async function mark(rows) {
    if (!Array.isArray(rows) || !rows.length) return rows;
    let focus = null;
    try { focus = await get(); } catch { return rows; }
    if (!focus?.product_id) return rows;
    for (const r of rows) {
      if (r && (String(r.id) === focus.product_id || String(r.parent_id || '') === focus.product_id)) r.bot_focus = true;
    }
    return rows;
  }
  function register(fastify, { requireAdminBearerToken }) {
    fastify.get('/admin/bot-focus-product', { preHandler: requireAdminBearerToken }, async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return { focus: await get() };
    });
    fastify.put('/admin/bot-focus-product', { preHandler: requireAdminBearerToken }, async (request, reply) => {
      try {
        const focus = await set(request.body?.product_id || null, request.user?.email || request.user?.id || null);
        return { focus };
      } catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
    });
  }
  return { get, set, mark, register };
}

module.exports = { createBotFocusProduct, KEY };
