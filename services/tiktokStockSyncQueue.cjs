'use strict';

function createTikTokStockSyncQueue({ pool, loadTargets, syncTargets, logger = console, intervalMs = 2000 }) {
  let ready;
  let running = false;
  let timer;

  function ensureSchema() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS tiktok_stock_sync_outbox (
      product_id CHAR(36) NOT NULL PRIMARY KEY,
      version BIGINT UNSIGNED NOT NULL DEFAULT 1,
      reason VARCHAR(80) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_error VARCHAR(1000) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX pending_tiktok_stock (status, next_attempt_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      .catch(error => { ready = undefined; throw error; });
    return ready;
  }

  async function enqueue(productIds, reason = 'stock_changed') {
    const ids = [...new Set((productIds || []).map(value => String(value || '').trim()).filter(Boolean))];
    if (!ids.length) return [];
    await ensureSchema();
    for (const productId of ids) {
      await pool.query(`INSERT INTO tiktok_stock_sync_outbox
        (product_id,reason,status,attempts,next_attempt_at,last_error)
        VALUES (?,?,'pending',0,NOW(3),NULL)
        ON DUPLICATE KEY UPDATE version=version+1,reason=VALUES(reason),status='pending',attempts=0,
          next_attempt_at=NOW(3),last_error=NULL,updated_at=NOW(3)`, [productId, String(reason).slice(0, 80)]);
    }
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(`SELECT product_id,version FROM tiktok_stock_sync_outbox
      WHERE product_id IN (${placeholders})`, ids);
    return rows || [];
  }

  async function complete(entries) {
    for (const entry of entries || []) {
      await pool.query(`UPDATE tiktok_stock_sync_outbox
        SET status='done',last_error=NULL,updated_at=NOW(3)
        WHERE product_id=? AND version=?`, [entry.product_id, entry.version]);
    }
  }

  async function tick() {
    if (running) return;
    running = true;
    let db;
    let locked = false;
    try {
      await ensureSchema();
      db = await pool.getConnection();
      const [locks] = await db.query("SELECT GET_LOCK('mdv_tiktok_stock_outbox',0) AS acquired");
      locked = Number(locks[0]?.acquired) === 1;
      if (!locked) return;
      await db.query(`UPDATE tiktok_stock_sync_outbox SET status='pending'
        WHERE status='processing' AND updated_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`);
      const [rows] = await db.query(`SELECT product_id,version,attempts FROM tiktok_stock_sync_outbox
        WHERE status='pending' AND next_attempt_at<=NOW(3) ORDER BY updated_at,product_id LIMIT 1`);
      if (!rows.length) return;
      const row = rows[0];
      await db.query(`UPDATE tiktok_stock_sync_outbox SET status='processing',attempts=attempts+1,updated_at=NOW(3)
        WHERE product_id=? AND version=?`, [row.product_id, row.version]);
      try {
        const targets = await loadTargets([row.product_id]);
        const result = await syncTargets(targets, { skipQueue: true });
        if (!result?.ok) throw new Error(result?.errors?.[0]?.message || 'TikTok stock synchronization failed');
        await db.query(`UPDATE tiktok_stock_sync_outbox SET status='done',last_error=NULL,updated_at=NOW(3)
          WHERE product_id=? AND version=?`, [row.product_id, row.version]);
      } catch (error) {
        const delay = Math.min(1800, 5 * 2 ** Math.min(Number(row.attempts), 9));
        await db.query(`UPDATE tiktok_stock_sync_outbox SET status='pending',last_error=?,
          next_attempt_at=DATE_ADD(NOW(3),INTERVAL ? SECOND),updated_at=NOW(3)
          WHERE product_id=? AND version=?`, [String(error.message).slice(0, 1000), delay, row.product_id, row.version]);
        logger.warn('[tiktok-stock-outbox] synchronization retained for retry', {
          product_id: row.product_id, attempt: Number(row.attempts) + 1,
        });
      }
    } catch (error) {
      logger.error('[tiktok-stock-outbox] worker failed:', error.message);
    } finally {
      if (locked) await db.query("SELECT RELEASE_LOCK('mdv_tiktok_stock_outbox')").catch(() => {});
      db?.release();
      running = false;
    }
  }

  async function start() {
    await ensureSchema();
    timer = setInterval(() => void tick(), intervalMs);
    timer.unref?.();
  }

  async function getStatus(limit = 25) {
    await ensureSchema();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
    const [summary] = await pool.query(`SELECT status,COUNT(*) AS total,MIN(updated_at) AS oldest_at
      FROM tiktok_stock_sync_outbox GROUP BY status ORDER BY status`);
    const [pending] = await pool.query(`SELECT product_id,reason,status,attempts,next_attempt_at,last_error,updated_at
      FROM tiktok_stock_sync_outbox WHERE status<>'done'
      ORDER BY next_attempt_at,updated_at LIMIT ?`, [safeLimit]);
    return { summary: summary || [], pending: pending || [] };
  }

  function stop() { clearInterval(timer); }
  return { ensureSchema, enqueue, complete, tick, start, stop, getStatus };
}

module.exports = { createTikTokStockSyncQueue };
