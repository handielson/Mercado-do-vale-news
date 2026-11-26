'use strict';
// stock-write-off-v1: baixa administrativa de estoque (avaria/descarte, uso na loja, brinde, perda, outro).
// Passa pelo Bling: lança uma SAÍDA no Bling com o motivo e o responsável nas observações; só depois baixa no MdV.
const { randomUUID } = require('node:crypto');

const KINDS = {
  avaria: 'Avaria / defeito (descarte)',
  uso_loja: 'Retirada para uso na loja',
  brinde: 'Brinde / doação',
  perda: 'Perda / extravio',
  outro: 'Outro',
};

function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function blingNotes({ kind, reason, responsible, imei }) {
  const parts = [`Baixa administrativa MdV - ${KINDS[kind] || kind}`, `Motivo: ${reason}`, `Responsável: ${responsible}`];
  if (imei) parts.push(`IMEI: ${imei}`);
  return parts.join(' | ').slice(0, 500);
}

function validate(input = {}) {
  const kind = clean(input.kind, 20);
  if (!KINDS[kind]) fail(400, 'Escolha o tipo da baixa.');
  const reason = clean(input.reason, 300);
  if (reason.length < 3) fail(400, 'Escreva o motivo da baixa.');
  const responsible = clean(input.responsible, 120);
  if (responsible.length < 2) fail(400, 'Informe quem está dando a baixa.');
  const productId = clean(input.product_id, 36);
  if (!productId) fail(400, 'Escolha o produto.');
  const quantity = input.unit_id ? 1 : Number(input.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1) fail(400, 'Informe uma quantidade inteira maior que zero.');
  return { kind, reason, responsible, productId, quantity, unitId: clean(input.unit_id, 36) || null,
    locationId: clean(input.location_id, 36) || null, saleId: clean(input.sale_id, 36) || null };
}

async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS stock_write_offs (
    id CHAR(36) PRIMARY KEY,
    company_id CHAR(36) NULL,
    product_id CHAR(36) NOT NULL,
    product_name VARCHAR(500) NULL,
    sku VARCHAR(120) NULL,
    quantity INT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    responsible VARCHAR(120) NOT NULL,
    unit_id CHAR(36) NULL,
    imei VARCHAR(40) NULL,
    deposit_id CHAR(36) NULL,
    location_id CHAR(36) NULL,
    sale_id CHAR(36) NULL,
    bling_id VARCHAR(40) NULL,
    bling_deposit_id VARCHAR(40) NULL,
    bling_notes VARCHAR(500) NULL,
    created_by VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_write_offs_created (created_at),
    INDEX idx_stock_write_offs_product (product_id),
    INDEX idx_stock_write_offs_kind (kind)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// Depósito do Bling: o mesmo critério do stock-sync (venda do PDV).
async function resolveBlingDeposit({ fetchImpl, authHeader, env }) {
  const configured = String(env.BLING_STOCK_SYNC_DEPOSIT_ID || '').trim();
  if (configured) return configured;
  const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const wanted = norm(env.BLING_STOCK_SYNC_DEPOSIT_NAME || 'Depósito 01 (Loja)');
  const res = await fetchImpl('https://api.bling.com.br/Api/v3/depositos?pagina=1&limite=100', { headers: { Authorization: authHeader, Accept: 'application/json' } });
  if (!res.ok) fail(502, `Bling não listou os depósitos (HTTP ${res.status}).`);
  const list = (await res.json().catch(() => ({})))?.data || [];
  const found = list.find((d) => norm(d?.descricao || d?.nome) === wanted) || list.find((d) => norm(d?.descricao || d?.nome).includes(wanted)) || list[0];
  if (!found?.id) fail(502, 'Nenhum depósito encontrado no Bling.');
  return String(found.id);
}

async function postBlingMovement({ fetchImpl, authHeader, blingId, depositId, operation, quantity, notes }) {
  const res = await fetchImpl('https://api.bling.com.br/Api/v3/estoques', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ produto: { id: Number(blingId) }, deposito: { id: Number(depositId) }, operacao: operation, quantidade: quantity, observacoes: notes }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(502, `O Bling recusou a baixa (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

function createStockWriteOffs({ pool, getBlingAuthHeader, syncProductStock, syncMarketplaceStock, getDefaultCompanyId,
  fetchImpl = fetch, env = process.env, logger = console } = {}) {
  let ready = null;
  const init = () => (ready ||= ensureTable(pool));

  async function create(input, { createdBy = 'web' } = {}) {
    await init();
    const v = validate(input);
    const [[product]] = await pool.query('SELECT id, company_id, name, sku, bling_id, is_combo FROM products WHERE id = ? LIMIT 1', [v.productId]);
    if (!product) fail(404, 'Produto não encontrado.');
    if (Number(product.is_combo)) fail(409, 'Kit/combo não tem estoque próprio: dê baixa nos itens do kit.');
    if (!product.bling_id) fail(409, 'Produto sem vínculo com o Bling: a baixa precisa passar pelo Bling.');

    // Produto com IMEI: a baixa é de um aparelho específico.
    const [[serial]] = await pool.query("SELECT COUNT(*) AS n FROM units WHERE product_id = ? AND status IN ('available','reserved')", [v.productId]);
    const serialized = Number(serial?.n) > 0;
    let unit = null;
    if (serialized || v.unitId) {
      if (!v.unitId) fail(400, 'Produto com IMEI: escolha o aparelho que vai sair.');
      [[unit]] = await pool.query('SELECT id, product_id, imei_1, imei_2, status, deposit_id, location_id FROM units WHERE id = ? LIMIT 1', [v.unitId]);
      if (!unit || unit.product_id !== v.productId) fail(404, 'Aparelho não encontrado neste produto.');
      if (unit.status !== 'available') fail(409, 'Só dá para baixar aparelho disponível (este está ' + unit.status + ').');
    }

    // Local de onde sai (sem IMEI): o informado ou o que tiver mais saldo livre.
    let balance = null;
    if (!unit) {
      const [rows] = await pool.query(`SELECT * FROM product_stock_locations WHERE product_id = ? ${v.locationId ? 'AND location_id = ?' : ''}
        ORDER BY (quantity - reserved_quantity) DESC LIMIT 1`, v.locationId ? [v.productId, v.locationId] : [v.productId]);
      balance = rows[0] || null;
      const free = balance ? Number(balance.quantity) - Number(balance.reserved_quantity) : 0;
      if (free < v.quantity) fail(409, `Saldo livre insuficiente${v.locationId ? ' neste local' : ''}: tem ${Math.max(0, free)}.`);
    }

    const imei = unit ? (unit.imei_1 || unit.imei_2 || null) : null;
    const notes = blingNotes({ kind: v.kind, reason: v.reason, responsible: v.responsible, imei });
    const authHeader = await getBlingAuthHeader();
    if (!authHeader) fail(409, 'Bling desconectado: conecte o Bling antes de dar baixa.');
    const blingDepositId = await resolveBlingDeposit({ fetchImpl, authHeader, env });
    await postBlingMovement({ fetchImpl, authHeader, blingId: product.bling_id, depositId: blingDepositId, operation: 'S', quantity: v.quantity, notes });

    const id = randomUUID();
    const companyId = product.company_id || await getDefaultCompanyId?.() || null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (unit) {
        const [r] = await connection.query("UPDATE units SET status = 'written_off', internal_notes = CONCAT_WS('\n', NULLIF(internal_notes, ''), ?) WHERE id = ? AND status = 'available'", [`Baixa: ${KINDS[v.kind]} - ${v.reason} - ${v.responsible}`, unit.id]);
        if (!r.affectedRows) fail(409, 'O aparelho mudou de situação durante a baixa.');
      } else {
        const [[locked]] = await connection.query('SELECT * FROM product_stock_locations WHERE id = ? FOR UPDATE', [balance.id]);
        const previous = Number(locked.quantity);
        const next = previous - v.quantity;
        if (next < Number(locked.reserved_quantity)) fail(409, 'O saldo mudou durante a baixa; tente de novo.');
        await connection.query('UPDATE product_stock_locations SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, locked.id]);
        await connection.query(`INSERT INTO stock_location_movements
          (id, company_id, product_id, from_deposit_id, from_location_id, to_deposit_id, to_location_id, quantity, movement_type, reason,
           reference_type, reference_id, previous_from_quantity, new_from_quantity, previous_to_quantity, new_to_quantity, notes, created_by)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 'write_off', ?, 'stock_write_off', ?, ?, ?, NULL, NULL, ?, ?)`,
          [randomUUID(), companyId || locked.company_id, v.productId, locked.deposit_id, locked.location_id, v.quantity,
            KINDS[v.kind].slice(0, 255), id, previous, next, `${v.reason} — ${v.responsible}`, createdBy]);
        const [[total]] = await connection.query('SELECT COALESCE(SUM(quantity), 0) AS q FROM product_stock_locations WHERE product_id = ?', [v.productId]);
        await connection.query('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [Number(total.q), v.productId]);
      }
      await connection.query(`INSERT INTO stock_write_offs
        (id, company_id, product_id, product_name, sku, quantity, kind, reason, responsible, unit_id, imei, deposit_id, location_id, sale_id,
         bling_id, bling_deposit_id, bling_notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, companyId, v.productId, product.name, product.sku, v.quantity, v.kind, v.reason, v.responsible, unit?.id || null, imei,
          unit?.deposit_id || balance?.deposit_id || null, unit?.location_id || balance?.location_id || null, v.saleId,
          String(product.bling_id), blingDepositId, notes, createdBy]);
      if (unit) await syncProductStock(v.productId, connection, { stockLocationInTransaction: true });
      await connection.commit();
    } catch (error) {
      try { await connection.rollback(); } catch {}
      // O Bling já saiu: devolve lá para não ficar diferente do MdV.
      await postBlingMovement({ fetchImpl, authHeader, blingId: product.bling_id, depositId: blingDepositId, operation: 'E', quantity: v.quantity,
        notes: `Estorno automático da baixa MdV (falhou no MdV): ${v.reason}`.slice(0, 500) })
        .catch((e) => logger.error('[stock-write-off] estorno no Bling falhou', product.bling_id, e.message));
      throw error;
    } finally { connection.release(); }

    if (syncMarketplaceStock) await syncMarketplaceStock([v.productId], 'stock_write_off').catch(() => {});
    return { id, product_id: v.productId, product_name: product.name, sku: product.sku, quantity: v.quantity, kind: v.kind,
      kind_label: KINDS[v.kind], reason: v.reason, responsible: v.responsible, imei, bling_notes: notes };
  }

  async function list({ limit = 100, kind = '' } = {}) {
    await init();
    const safe = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const where = KINDS[kind] ? 'WHERE kind = ?' : '';
    const [rows] = await pool.query(`SELECT w.*, d.name AS deposit_name, l.name AS location_name FROM stock_write_offs w
      LEFT JOIN stock_deposits d ON d.id = w.deposit_id LEFT JOIN stock_locations l ON l.id = w.location_id
      ${where} ORDER BY w.created_at DESC LIMIT ${safe}`, KINDS[kind] ? [kind] : []);
    return rows.map((r) => ({ ...r, kind_label: KINDS[r.kind] || r.kind }));
  }

  function register(fastify, { preHandler }) {
    fastify.get('/stock-write-offs/kinds', { preHandler }, async () => Object.entries(KINDS).map(([value, label]) => ({ value, label })));
    fastify.get('/stock-write-offs', { preHandler }, async (req) => list(req.query || {}));
    fastify.post('/stock-write-offs', { preHandler }, async (req, reply) => {
      try {
        return await create(req.body || {}, { createdBy: String(req.headers['x-mdv-client'] || 'web').slice(0, 120) });
      } catch (error) {
        return reply.code(error.statusCode || 500).send({ error: error.message });
      }
    });
  }

  return { create, list, register, init };
}

module.exports = { createStockWriteOffs, KINDS, blingNotes, validate };
