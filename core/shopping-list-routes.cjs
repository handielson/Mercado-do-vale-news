'use strict';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(['pending', 'quoted', 'purchased', 'cancelled']);
const asInt = (value, fallback = 0) => Math.max(0, parseInt(value, 10) || fallback);
const asText = (value, max = 255) => String(value || '').trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

async function ensureShoppingListSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      source_key VARCHAR(180) NULL UNIQUE,
      source_type ENUM('daily_sales','manual_product','manual_item') NOT NULL,
      product_id CHAR(36) NULL,
      item_name VARCHAR(255) NOT NULL,
      sku VARCHAR(120) NULL,
      requested_quantity INT NOT NULL,
      sales_quantity_today INT NOT NULL DEFAULT 0,
      current_stock INT NOT NULL DEFAULT 0,
      status ENUM('pending','quoted','purchased','cancelled') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      cancelled_reason TEXT NULL,
      created_by VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_shopping_list_status (status, updated_at),
      INDEX idx_shopping_list_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_list_quotes (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      shopping_list_item_id CHAR(36) NOT NULL,
      supplier_name VARCHAR(255) NOT NULL,
      purchase_location VARCHAR(255) NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      quoted_at DATE NOT NULL,
      notes TEXT NULL,
      is_valid TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_shopping_quote_item FOREIGN KEY (shopping_list_item_id) REFERENCES shopping_list_items(id) ON DELETE CASCADE,
      INDEX idx_shopping_quote_item_price (shopping_list_item_id, is_valid, unit_price)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_list_purchases (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      shopping_list_item_id CHAR(36) NOT NULL,
      supplier_name VARCHAR(255) NOT NULL,
      purchase_location VARCHAR(255) NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      purchased_at DATE NOT NULL,
      notes TEXT NULL,
      operator_name VARCHAR(255) NOT NULL,
      created_by VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_shopping_purchase_item FOREIGN KEY (shopping_list_item_id) REFERENCES shopping_list_items(id) ON DELETE RESTRICT,
      INDEX idx_shopping_purchase_date (purchased_at, created_at),
      INDEX idx_shopping_purchase_item (shopping_list_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // Adaptador de integração: todo PDV/canal que ainda não persiste vendas nesta
  // instância MySQL pode alimentar o resumo diário por esta tabela/API.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_list_daily_sales (
      sale_date DATE NOT NULL,
      product_id CHAR(36) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      sku VARCHAR(120) NULL,
      quantity INT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (sale_date, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] shopping list tables: OK');
}

function bestQuoteJoin() {
  return `LEFT JOIN shopping_list_quotes best_quote ON best_quote.id = (
    SELECT q2.id FROM shopping_list_quotes q2
    WHERE q2.shopping_list_item_id = i.id AND q2.is_valid = 1
    ORDER BY q2.unit_price ASC, q2.quoted_at ASC, q2.created_at ASC LIMIT 1
  )`;
}

async function getItem(pool, id) {
  const [rows] = await pool.query(`
    SELECT i.*, best_quote.id AS best_quote_id, best_quote.supplier_name AS best_supplier_name,
           best_quote.purchase_location AS best_purchase_location, best_quote.unit_price AS best_unit_price,
           best_quote.quantity AS best_quote_quantity, best_quote.quoted_at AS best_quoted_at
    FROM shopping_list_items i ${bestQuoteJoin()} WHERE i.id = ?`, [id]);
  return rows[0] || null;
}

async function dailySalesRows(pool, date) {
  const [[salesTable]] = await pool.query(
    `SELECT COUNT(*) AS available FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'`,
  );
  const [[itemsTable]] = await pool.query(
    `SELECT COUNT(*) AS available FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items'`,
  );
  if (salesTable.available && itemsTable.available) {
    const [rows] = await pool.query(`
      SELECT si.product_id, MAX(COALESCE(si.product_name, 'Produto')) AS item_name,
             MAX(si.product_sku) AS sku, SUM(si.quantity) AS quantity
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND DATE(s.created_at) = ? AND si.product_id IS NOT NULL
      GROUP BY si.product_id`, [date]);
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT product_id, item_name, sku, quantity FROM shopping_list_daily_sales WHERE sale_date = ?`, [date]);
  return rows;
}

function registerShoppingListRoutes({ fastify, pool, preHandler }) {
  const secured = { preHandler };

  fastify.get('/shopping-list/items', secured, async (req) => {
    const requestedStatus = asText(req.query?.status, 20);
    const where = VALID_STATUSES.has(requestedStatus) ? 'WHERE i.status = ?' : '';
    const params = where ? [requestedStatus] : [];
    const [rows] = await pool.query(`
      SELECT i.*, best_quote.id AS best_quote_id, best_quote.supplier_name AS best_supplier_name,
             best_quote.purchase_location AS best_purchase_location, best_quote.unit_price AS best_unit_price,
             best_quote.quantity AS best_quote_quantity, best_quote.quoted_at AS best_quoted_at
      FROM shopping_list_items i ${bestQuoteJoin()} ${where}
      ORDER BY FIELD(i.status, 'pending', 'quoted', 'purchased', 'cancelled'), i.updated_at DESC`, params);
    return rows;
  });

  fastify.get('/shopping-list/items/:id', secured, async (req, reply) => {
    const item = await getItem(pool, req.params.id);
    if (!item) return reply.code(404).send({ error: 'Item da lista não encontrado.' });
    const [quotes] = await pool.query('SELECT * FROM shopping_list_quotes WHERE shopping_list_item_id = ? ORDER BY is_valid DESC, unit_price ASC, quoted_at DESC', [item.id]);
    return { ...item, quotes };
  });

  fastify.post('/shopping-list/sync-daily-sales', secured, async (req) => {
    const saleDate = DAY.test(asText(req.body?.sale_date, 10)) ? req.body.sale_date : today();
    const rows = await dailySalesRows(pool, saleDate);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const row of rows) {
        const [[product]] = await connection.query('SELECT id, name, sku, stock_quantity FROM products WHERE id = ? LIMIT 1', [row.product_id]);
        if (!product) continue;
        await connection.query(`
          INSERT INTO shopping_list_items (source_key, source_type, product_id, item_name, sku, requested_quantity, sales_quantity_today, current_stock)
          VALUES (?, 'daily_sales', ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE item_name = VALUES(item_name), sku = VALUES(sku), requested_quantity = VALUES(requested_quantity),
            sales_quantity_today = VALUES(sales_quantity_today), current_stock = VALUES(current_stock), updated_at = CURRENT_TIMESTAMP`,
          [`daily-sales:${saleDate}:${product.id}`, product.id, product.name || row.item_name, product.sku || row.sku || null, asInt(row.quantity), asInt(row.quantity), asInt(product.stock_quantity)]);
      }
      await connection.commit();
      return { ok: true, sale_date: saleDate, synchronized_items: rows.length, source: rows.length ? 'mysql_sales' : 'daily_sales_adapter' };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.post('/shopping-list/daily-sales', secured, async (req, reply) => {
    const saleDate = DAY.test(asText(req.body?.sale_date, 10)) ? req.body.sale_date : today();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return reply.code(400).send({ error: 'Informe os itens vendidos.' });
    for (const item of items) {
      const productId = asText(item.product_id, 36);
      const quantity = asInt(item.quantity);
      if (!productId || !quantity) return reply.code(400).send({ error: 'Cada venda precisa de produto e quantidade positiva.' });
      const [[product]] = await pool.query('SELECT id, name, sku FROM products WHERE id = ? LIMIT 1', [productId]);
      if (!product) return reply.code(404).send({ error: `Produto ${productId} não encontrado.` });
      await pool.query(`INSERT INTO shopping_list_daily_sales (sale_date, product_id, item_name, sku, quantity)
        VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), item_name = VALUES(item_name), sku = VALUES(sku)`,
      [saleDate, product.id, product.name, product.sku || null, quantity]);
    }
    return { ok: true, sale_date: saleDate, items: items.length };
  });

  fastify.post('/shopping-list/items/registered', secured, async (req, reply) => {
    const productId = asText(req.body?.product_id, 36); const quantity = asInt(req.body?.quantity);
    if (!productId || !quantity) return reply.code(400).send({ error: 'Produto e quantidade positiva são obrigatórios.' });
    const [[product]] = await pool.query('SELECT id, name, sku, stock_quantity FROM products WHERE id = ? LIMIT 1', [productId]);
    if (!product) return reply.code(404).send({ error: 'Produto não encontrado.' });
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO shopping_list_items (id, source_type, product_id, item_name, sku, requested_quantity, current_stock, notes, created_by)
      VALUES (?, 'manual_product', ?, ?, ?, ?, ?, ?, ?)`, [id, product.id, product.name, product.sku || null, quantity, asInt(product.stock_quantity), asText(req.body?.notes, 5000) || null, asText(req.body?.operator_name) || null]);
    return getItem(pool, id);
  });

  fastify.post('/shopping-list/items/loose', secured, async (req, reply) => {
    const name = asText(req.body?.item_name); const quantity = asInt(req.body?.quantity);
    if (!name || !quantity) return reply.code(400).send({ error: 'Identificação e quantidade positiva são obrigatórias.' });
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO shopping_list_items (id, source_type, item_name, sku, requested_quantity, notes, created_by)
      VALUES (?, 'manual_item', ?, ?, ?, ?, ?)`, [id, name, asText(req.body?.sku, 120) || null, quantity, asText(req.body?.notes, 5000) || null, asText(req.body?.operator_name) || null]);
    return getItem(pool, id);
  });

  fastify.post('/shopping-list/items/:id/quotes', secured, async (req, reply) => {
    const item = await getItem(pool, req.params.id);
    if (!item) return reply.code(404).send({ error: 'Item da lista não encontrado.' });
    if (!['pending', 'quoted'].includes(item.status)) return reply.code(409).send({ error: 'Não é possível orçar um item encerrado.' });
    const supplier = asText(req.body?.supplier_name); const unitPrice = Number(req.body?.unit_price); const quantity = asInt(req.body?.quantity);
    if (!supplier || !(unitPrice > 0) || !quantity) return reply.code(400).send({ error: 'Fornecedor, preço unitário e quantidade positiva são obrigatórios.' });
    const id = crypto.randomUUID(); const quotedAt = DAY.test(asText(req.body?.quoted_at, 10)) ? req.body.quoted_at : today();
    await pool.query(`INSERT INTO shopping_list_quotes (id, shopping_list_item_id, supplier_name, purchase_location, unit_price, quantity, quoted_at, notes, is_valid, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, item.id, supplier, asText(req.body?.purchase_location) || null, unitPrice, quantity, quotedAt, asText(req.body?.notes, 5000) || null, req.body?.is_valid === false ? 0 : 1, asText(req.body?.operator_name) || null]);
    if (item.status === 'pending') await pool.query("UPDATE shopping_list_items SET status = 'quoted' WHERE id = ?", [item.id]);
    const [[quote]] = await pool.query('SELECT * FROM shopping_list_quotes WHERE id = ?', [id]);
    return quote;
  });

  fastify.post('/shopping-list/items/:id/purchase', secured, async (req, reply) => {
    const supplier = asText(req.body?.supplier_name); const quantity = asInt(req.body?.quantity); const unitPrice = Number(req.body?.unit_price); const operator = asText(req.body?.operator_name);
    if (!supplier || !operator || !quantity || unitPrice < 0) return reply.code(400).send({ error: 'Fornecedor, operador, quantidade e preço pago são obrigatórios.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[item]] = await connection.query('SELECT * FROM shopping_list_items WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!item) {
        await connection.rollback();
        return reply.code(404).send({ error: 'Item da lista não encontrado.' });
      }
      if (item.status !== 'quoted') return reply.code(409).send({ error: 'A compra só pode ser confirmada para um item orçado.' });
      const id = crypto.randomUUID(); const purchasedAt = DAY.test(asText(req.body?.purchased_at, 10)) ? req.body.purchased_at : today();
      await connection.query(`INSERT INTO shopping_list_purchases (id, shopping_list_item_id, supplier_name, purchase_location, quantity, unit_price, purchased_at, notes, operator_name, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, item.id, supplier, asText(req.body?.purchase_location) || null, quantity, unitPrice, purchasedAt, asText(req.body?.notes, 5000) || null, operator, operator]);
      await connection.query("UPDATE shopping_list_items SET status = 'purchased' WHERE id = ?", [item.id]);
      await connection.commit();
      const [[purchase]] = await pool.query('SELECT * FROM shopping_list_purchases WHERE id = ?', [id]);
      return purchase;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  fastify.post('/shopping-list/items/:id/cancel', secured, async (req, reply) => {
    const reason = asText(req.body?.reason, 5000); if (!reason) return reply.code(400).send({ error: 'Informe o motivo do cancelamento.' });
    const [result] = await pool.query("UPDATE shopping_list_items SET status = 'cancelled', cancelled_reason = ? WHERE id = ? AND status IN ('pending', 'quoted')", [reason, req.params.id]);
    if (!result.affectedRows) return reply.code(409).send({ error: 'Somente itens pendentes ou orçados podem ser cancelados.' });
    return { ok: true };
  });

  fastify.get('/shopping-list/quotes', secured, async () => {
    const [rows] = await pool.query(`SELECT i.*, best_quote.id AS best_quote_id, best_quote.supplier_name AS best_supplier_name,
      best_quote.purchase_location AS best_purchase_location, best_quote.unit_price AS best_unit_price, best_quote.quantity AS best_quote_quantity, best_quote.quoted_at AS best_quoted_at
      FROM shopping_list_items i ${bestQuoteJoin()} WHERE i.status IN ('quoted', 'purchased') ORDER BY best_quote.supplier_name, i.item_name`);
    return rows;
  });

  fastify.get('/shopping-list/purchases', secured, async () => {
    const [rows] = await pool.query(`SELECT p.*, i.item_name, i.sku FROM shopping_list_purchases p JOIN shopping_list_items i ON i.id = p.shopping_list_item_id ORDER BY p.purchased_at DESC, p.created_at DESC`);
    return rows;
  });
}

module.exports = { ensureShoppingListSchema, registerShoppingListRoutes };
