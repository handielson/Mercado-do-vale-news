const crypto = require('node:crypto');

// webhook_logs is an audit trail, not a retry queue: its inserts are best effort.
// This inbox must commit before acknowledging delivery to Bling.
function createBlingStockWebhookQueue({ pool, processEvent, logger = console, intervalMs = 2000 }) {
  let running = false;
  let timer;
  let ready;
  function ensureSchema() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS bling_stock_webhook_inbox (
      id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      payload JSON NOT NULL, request_context JSON NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
      next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_error VARCHAR(1000) NULL,
      INDEX pending_events (status, next_attempt_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      .catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function enqueue(request) {
    await ensureSchema();
    const payload = request.body;
    const eventId = payload.eventId || payload.idEvento;
    const identity = eventId ? `event:${eventId}` : JSON.stringify(payload);
    const id = crypto.createHash('sha256').update(identity).digest('hex');
    const context = { url: request.url, query: request.query || {}, protocol: request.protocol,
      headers: { host: request.headers?.host } };
    let duplicate = false;
    try {
      await pool.query(`INSERT INTO bling_stock_webhook_inbox (id,payload,request_context)
        VALUES (?,?,?)`, [id, JSON.stringify(payload), JSON.stringify(context)]);
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      duplicate = true;
    }
    return { ok: true, queued: true, duplicate, receipt: id };
  }
  async function tick() {
    if (running) return;
    running = true;
    let db;
    let locked = false;
    try {
      await ensureSchema();
      db = await pool.getConnection();
      const [locks] = await db.query("SELECT GET_LOCK('mdv_bling_stock_webhook',0) AS acquired");
      locked = Number(locks[0]?.acquired) === 1;
      if (!locked) return;
      // A process killed after claiming a receipt must not lose that receipt.
      await db.query(`UPDATE bling_stock_webhook_inbox SET status='pending'
        WHERE status='processing' AND updated_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`);
      const [rows] = await db.query(`SELECT id,payload,request_context,attempts FROM bling_stock_webhook_inbox
        WHERE status='pending' AND next_attempt_at<=NOW(3) ORDER BY received_at,id LIMIT 1`);
      if (!rows.length) return;
      const row = rows[0];
      await db.query(`UPDATE bling_stock_webhook_inbox SET status='processing',attempts=attempts+1,updated_at=NOW(3) WHERE id=?`, [row.id]);
      try {
        const decode = value => typeof value === 'string' ? JSON.parse(value) : value;
        const result = await processEvent({ ...decode(row.request_context), method: 'POST', body: decode(row.payload) });
        if (!result || result.ok !== true) throw new Error(result?.error || result?.reason || result?.message || 'Stock processing failed');
        await db.query(`UPDATE bling_stock_webhook_inbox SET status='done',last_error=NULL,updated_at=NOW(3) WHERE id=?`, [row.id]);
      } catch (error) {
        const delay = Math.min(900, 5 * 2 ** Math.min(Number(row.attempts), 8));
        await db.query(`UPDATE bling_stock_webhook_inbox SET status='pending',last_error=?,
          next_attempt_at=DATE_ADD(NOW(3),INTERVAL ? SECOND),updated_at=NOW(3) WHERE id=?`,
        [String(error.message).slice(0, 1000), delay, row.id]);
        logger.warn('[bling-stock-inbox] Processing failed; receipt retained for retry', { receipt: row.id, attempt: Number(row.attempts) + 1 });
      }
    } catch (error) {
      logger.error('[bling-stock-inbox] Worker failed:', error.message);
    } finally {
      if (locked) await db.query("SELECT RELEASE_LOCK('mdv_bling_stock_webhook')").catch(() => {});
      db?.release();
      running = false;
    }
  }
  async function start() {
    await ensureSchema();
    timer = setInterval(() => void tick(), intervalMs);
    timer.unref?.();
  }
  function stop() { clearInterval(timer); }
  return { enqueue, tick, start, stop };
}

function isBlingStockEvent(body) {
  const event = String(body?.event || body?.evento || '').toLowerCase();
  return event.includes('stock') || event.includes('estoque') || event.includes('movimentacao');
}

module.exports = { createBlingStockWebhookQueue, isBlingStockEvent };
