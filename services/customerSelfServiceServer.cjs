const crypto = require('crypto');

function firstName(value) {
  return String(value || 'Cliente').trim().split(/\s+/u)[0] || 'Cliente';
}

function parseArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || ''));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function ensureCustomerSelfServiceTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_type_requests (
      id CHAR(36) NOT NULL PRIMARY KEY,
      customer_id VARCHAR(80) NOT NULL,
      requested_type ENUM('wholesale', 'resale') NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      reviewed_by VARCHAR(80) NULL,
      rejection_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_customer_type_requests_customer (customer_id, created_at),
      KEY idx_customer_type_requests_status (status, requested_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS benefit_redemptions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      benefit_id VARCHAR(80) NOT NULL,
      \`year_month\` CHAR(7) NOT NULL,
      redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      redeemed_by VARCHAR(80) NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_benefit_redemption_month (benefit_id, \`year_month\`),
      KEY idx_benefit_redemptions_benefit (benefit_id, redeemed_at),
      KEY idx_benefit_redemptions_redeemer (redeemed_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_feedbacks (
      id CHAR(36) NOT NULL PRIMARY KEY,
      company_id VARCHAR(80) NOT NULL,
      type ENUM('Dúvida', 'Reclamação', 'Sugestão', 'Outro') NOT NULL,
      message TEXT NOT NULL,
      customer_name VARCHAR(255) NULL,
      customer_contact VARCHAR(255) NULL,
      status ENUM('novo', 'lido', 'respondido') NOT NULL DEFAULT 'novo',
      admin_reply TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_customer_feedbacks_company (company_id, created_at),
      KEY idx_customer_feedbacks_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function registerCustomerSelfServiceRoutes(fastify, { pool, getVpsBearerAuthContext, requireSyncKeyOrCustomer }) {
  fastify.get('/customer/checkin', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const [[settings], [logs]] = await Promise.all([
      pool.query('SELECT * FROM cashback_settings ORDER BY updated_at DESC LIMIT 1'),
      pool.query("SELECT *, DATE_FORMAT(checkin_date, '%Y-%m-%d') AS checkin_day FROM checkin_logs WHERE customer_id = ? ORDER BY checkin_date DESC LIMIT 1", [auth.customerId]),
    ]);
    const config = settings?.[0] || null;
    if (!config) return reply.code(503).send({ error: 'Programa de moedas indisponível' });
    const dailyValues = parseArray(config.checkin_daily_values, [Number(config.checkin_base_coins) || 1]);
    const latest = logs?.[0] || null;
    const [[clock]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
    const today = String(clock?.today || '');
    const lastDate = latest?.checkin_day ? String(latest.checkin_day) : null;
    const streak = Number(latest?.streak_day) || 0;
    const checkedInToday = lastDate === today;
    const upcomingDay = streak + 1;
    return {
      streak,
      lastCheckin: lastDate,
      checkedInToday,
      todayCoins: checkedInToday ? Number(latest?.coins_earned) || 0 : Number(dailyValues[(Math.max(1, upcomingDay) - 1) % dailyValues.length]) || 0,
      nextCoins: Number(dailyValues[(Math.max(1, upcomingDay + (checkedInToday ? 0 : 1)) - 1) % dailyValues.length]) || 0,
      dailyValues,
      cyclePosition: checkedInToday ? ((Math.max(1, streak) - 1) % dailyValues.length) + 1 : (streak % dailyValues.length) + 1,
    };
  });

  fastify.post('/customer/checkin', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [settingsRows] = await connection.query('SELECT * FROM cashback_settings ORDER BY updated_at DESC LIMIT 1 FOR UPDATE');
      const settings = settingsRows?.[0] || null;
      if (!settings?.active) {
        await connection.rollback();
        return { success: false, alreadyCheckedIn: false, coins_earned: 0, streak_day: 0, error: 'Sistema de moedas inativo' };
      }
      const [todayRows] = await connection.query('SELECT * FROM checkin_logs WHERE customer_id = ? AND checkin_date = CURDATE() LIMIT 1 FOR UPDATE', [auth.customerId]);
      if (todayRows?.[0]) {
        await connection.rollback();
        return { success: false, alreadyCheckedIn: true, coins_earned: Number(todayRows[0].coins_earned) || 0, streak_day: Number(todayRows[0].streak_day) || 0 };
      }
      const [yesterdayRows] = await connection.query('SELECT streak_day FROM checkin_logs WHERE customer_id = ? AND checkin_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) LIMIT 1', [auth.customerId]);
      const streakDay = (Number(yesterdayRows?.[0]?.streak_day) || 0) + 1;
      const dailyValues = parseArray(settings.checkin_daily_values, [Number(settings.checkin_base_coins) || 1]);
      const coins = Math.max(0, Number(dailyValues[(streakDay - 1) % dailyValues.length]) || 0);
      const checkinId = crypto.randomUUID();
      await connection.query('INSERT INTO checkin_logs (id, customer_id, checkin_date, coins_earned, streak_day) VALUES (?, ?, CURDATE(), ?, ?)', [checkinId, auth.customerId, coins, streakDay]);
      await connection.query(`INSERT INTO coin_balances (id, customer_id, balance, lifetime_earned, lifetime_spent)
        VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance), lifetime_earned = lifetime_earned + VALUES(lifetime_earned)`, [crypto.randomUUID(), auth.customerId, coins, coins]);
      await connection.query(`INSERT INTO coin_transactions (id, customer_id, amount, type, status, description, reference_id, reference_type)
        VALUES (?, ?, ?, ?, 'completed', ?, ?, 'checkin')`, [crypto.randomUUID(), auth.customerId, coins, streakDay % dailyValues.length === 0 ? 'earn_streak' : 'earn_checkin', `Check-in dia ${streakDay}`, checkinId]);
      await connection.commit();
      return { success: true, alreadyCheckedIn: false, coins_earned: coins, streak_day: streakDay };
    } catch (error) {
      await connection.rollback().catch(() => {});
      if (error?.code === 'ER_DUP_ENTRY') {
        const [rows] = await pool.query('SELECT coins_earned, streak_day FROM checkin_logs WHERE customer_id = ? AND checkin_date = CURDATE() LIMIT 1', [auth.customerId]);
        const row = rows?.[0] || {};
        return { success: false, alreadyCheckedIn: true, coins_earned: Number(row.coins_earned) || 0, streak_day: Number(row.streak_day) || 0 };
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  fastify.get('/customer/referrals/validate', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const code = String(req.query?.code || '').trim().toUpperCase();
    if (!code) return reply.code(400).send({ valid: false, error: 'Código vazio.' });
    const [rows] = await pool.query('SELECT id, name FROM customers WHERE UPPER(referral_code) = ? LIMIT 1', [code]);
    const referrer = rows?.[0] || null;
    if (!referrer) return { valid: false, error: 'Código de indicação inválido ou não encontrado.' };
    if (String(referrer.id) === String(auth.customerId)) return { valid: false, error: 'Você não pode usar seu próprio código de indicação.' };
    return { valid: true, referrerName: firstName(referrer.name) };
  });

  fastify.get('/customer/benefits', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const requestedCustomerId = String(req.query?.customer_id || '').trim();
    const customerId = auth.isAdmin && requestedCustomerId ? requestedCustomerId : auth.customerId;
    const [benefits] = await pool.query(`SELECT * FROM customer_benefits WHERE customer_id = ? AND promotion_type = 'one_year_screen_protector' ORDER BY granted_at DESC`, [customerId]);
    if (!benefits?.length) return [];
    const ids = benefits.map((benefit) => benefit.id);
    let redemptions = [];
    try {
      [redemptions] = await pool.query(`SELECT r.*, c.name AS redeemed_by_name FROM benefit_redemptions r LEFT JOIN customers c ON c.id = r.redeemed_by WHERE r.benefit_id IN (?) ORDER BY r.redeemed_at DESC`, [ids]);
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    return benefits.map((benefit) => {
      const rows = redemptions.filter((row) => String(row.benefit_id) === String(benefit.id)).map((row) => ({ ...row, redeemed_by_user: row.redeemed_by_name ? { name: row.redeemed_by_name } : undefined }));
      const expired = benefit.expires_at ? new Date(benefit.expires_at) < new Date() : false;
      return { benefit, redemptions: rows, monthsRemaining: expired ? 0 : Math.max(0, 12 - rows.length), canRedeemThisMonth: !expired && rows.length < 12 && !rows.some((row) => String(row.year_month) === currentYearMonth), currentYearMonth };
    });
  });

  fastify.get('/customer/type-upgrade', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const [rows] = await pool.query('SELECT * FROM customer_type_requests WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1', [auth.customerId]);
      return rows?.[0] || null;
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') return reply.code(503).send({ error: 'Solicitações de tipo de conta ainda não estão disponíveis.' });
      throw error;
    }
  });

  fastify.post('/customer/type-upgrade', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const requestedType = String(req.body?.requested_type || '').trim().toLowerCase();
    if (!['wholesale', 'resale'].includes(requestedType)) return reply.code(400).send({ error: 'Tipo de conta inválido.' });
    try {
      const [pending] = await pool.query("SELECT id FROM customer_type_requests WHERE customer_id = ? AND status = 'pending' LIMIT 1", [auth.customerId]);
      if (pending?.[0]) return reply.code(409).send({ error: 'Você já possui uma solicitação pendente.' });
      const id = crypto.randomUUID();
      await pool.query("INSERT INTO customer_type_requests (id, customer_id, requested_type, status, requested_at) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)", [id, auth.customerId, requestedType]);
      const [rows] = await pool.query('SELECT * FROM customer_type_requests WHERE id = ? LIMIT 1', [id]);
      return reply.code(201).send(rows?.[0] || { id, customer_id: auth.customerId, requested_type: requestedType, status: 'pending' });
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') return reply.code(503).send({ error: 'Solicitações de tipo de conta ainda não estão disponíveis.' });
      throw error;
    }
  });

  fastify.post('/public/feedback', async (req, reply) => {
    const allowedTypes = new Set(['Dúvida', 'Reclamação', 'Sugestão', 'Outro']);
    const type = String(req.body?.type || '').trim();
    const message = String(req.body?.message || '').trim().slice(0, 5000);
    const customerName = String(req.body?.customer_name || '').trim().slice(0, 255) || null;
    const customerContact = String(req.body?.customer_contact || '').trim().slice(0, 255) || null;
    if (!allowedTypes.has(type) || !message) return reply.code(400).send({ error: 'Mensagem inválida.' });
    try {
      const [companies] = await pool.query('SELECT id FROM companies ORDER BY created_at ASC LIMIT 1');
      const companyId = companies?.[0]?.id || null;
      if (!companyId) return reply.code(503).send({ error: 'Empresa não configurada.' });
      await pool.query("INSERT INTO customer_feedbacks (id, company_id, type, message, customer_name, customer_contact, status) VALUES (?, ?, ?, ?, ?, ?, 'novo')", [crypto.randomUUID(), companyId, type, message, customerName, customerContact]);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') return reply.code(503).send({ error: 'Canal de feedback ainda não está disponível.' });
      throw error;
    }
  });

  fastify.get('/public/products/:productId/reviews', async (req) => {
    const [rows] = await pool.query(`SELECT r.*, c.name AS customer_name, c.avatar_url AS customer_avatar_url
      FROM product_reviews r LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.created_at DESC LIMIT 200`, [String(req.params?.productId || '')]);
    return rows.map((row) => ({ ...row, customer: { name: firstName(row.customer_name), avatar_url: row.customer_avatar_url || null } }));
  });

  fastify.post('/customer/reviews', async (req, reply) => {
    const auth = await getVpsBearerAuthContext(req);
    if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
    const productId = String(req.body?.product_id || '').trim();
    const rating = Number(req.body?.rating);
    const reviewText = String(req.body?.review_text || '').trim().slice(0, 2000) || null;
    if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) return reply.code(400).send({ error: 'Avaliação inválida.' });
    const [products] = await pool.query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
    if (!products?.[0]) return reply.code(404).send({ error: 'Produto não encontrado.' });
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO product_reviews (id, product_id, customer_id, rating, review_text, status) VALUES (?, ?, ?, ?, ?, 'pending')`, [id, productId, auth.customerId, rating, reviewText]);
    const [rows] = await pool.query('SELECT * FROM product_reviews WHERE id = ? LIMIT 1', [id]);
    return reply.code(201).send(rows?.[0] || { id, product_id: productId, customer_id: auth.customerId, rating, review_text: reviewText, status: 'pending' });
  });

  fastify.post('/customer/orders/:orderId/pending-coins', { preHandler: requireSyncKeyOrCustomer }, async (req, reply) => {
    const access = req.customerAccess || {};
    const orderId = String(req.params?.orderId || '').trim();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [orderId]);
      const order = orders?.[0] || null;
      if (!order?.customer_id) {
        await connection.rollback();
        return reply.code(404).send({ error: 'Pedido não encontrado.' });
      }
      if (!access.isSync && !access.isAdmin && String(order.customer_id) !== String(access.customerId || '')) {
        await connection.rollback();
        return reply.code(403).send({ error: 'Forbidden for this order' });
      }
      if (['cancelled', 'payment_failed'].includes(String(order.status || '').toLowerCase())) {
        await connection.rollback();
        return { ok: true, skipped: true, coins: 0 };
      }
      const [existing] = await connection.query("SELECT id, amount FROM coin_transactions WHERE reference_id = ? AND reference_type = 'order' AND type = 'earn_purchase' AND status <> 'cancelled' LIMIT 1", [order.id]);
      if (existing?.[0]) {
        await connection.commit();
        return { ok: true, already_exists: true, coins: Number(existing[0].amount) || 0 };
      }
      const [settingsRows] = await connection.query('SELECT * FROM cashback_settings ORDER BY updated_at DESC LIMIT 1');
      const settings = settingsRows?.[0] || null;
      const eligibleReais = Math.max(0, (Number(order.subtotal) - Number(order.discount || 0)) / 100);
      if (!settings?.active || eligibleReais < Number(settings.min_purchase_for_coins || 0)) {
        await connection.rollback();
        return { ok: true, skipped: true, coins: 0 };
      }
      const coins = Math.floor(eligibleReais * Number(settings.coins_per_real || 0));
      if (coins <= 0) {
        await connection.rollback();
        return { ok: true, skipped: true, coins: 0 };
      }
      await connection.query(`INSERT INTO coin_transactions (id, customer_id, amount, type, status, description, reference_id, reference_type)
        VALUES (?, ?, ?, 'earn_purchase', 'pending', ?, ?, 'order')`, [crypto.randomUUID(), order.customer_id, coins, `Moedas pendentes do pedido ${String(order.id).slice(0, 8)}`, order.id]);
      await connection.commit();
      return { ok: true, coins };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  });
}

module.exports = { ensureCustomerSelfServiceTables, registerCustomerSelfServiceRoutes };
