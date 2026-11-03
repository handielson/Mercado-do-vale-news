'use strict';
// Cache persistente das vendas de marketplace (Shopee, TikTok Shop, Mercado Livre).
// A tela de vendas le daqui (MySQL, milissegundos) e uma sincronizacao em segundo
// plano busca nas APIs somente a janela recente; a varredura profunda e rara.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULTS = Object.freeze({
  recentWindowMs: 3 * DAY_MS,
  recentLimit: 150,
  deepWindowMs: 60 * DAY_MS,
  deepLimit: 1000,
  deepEveryMs: 6 * 60 * 60 * 1000,
  fullWindowMs: 366 * DAY_MS,
  fullLimit: 3000,
  minSyncIntervalMs: 60 * 1000,
  readLimit: 5000,
});

function toMysqlDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function fromMysqlDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourceKey(source) {
  return `${source.channel}:${source.connectionId || ''}`;
}

function normalizeSale(raw) {
  const externalId = String(raw?.external_id || '').trim();
  const occurredAt = toMysqlDate(raw?.occurred_at);
  if (!externalId || !occurredAt) return null;
  return { externalId: externalId.slice(0, 120), occurredAt, status: String(raw?.status || '').slice(0, 60), json: JSON.stringify(raw) };
}

function createMarketplaceSalesStore({ pool, listSources, logger = console, now = () => Date.now(), options = {} }) {
  if (!pool || typeof pool.query !== 'function') throw new Error('pool obrigatorio');
  if (typeof listSources !== 'function') throw new Error('listSources obrigatorio');
  const cfg = { ...DEFAULTS, ...options };
  const inflight = new Map();
  let tablesReady = null;
  let lastSyncAllAt = 0;
  let syncAllPromise = null;

  function ensureTables() {
    if (!tablesReady) {
      tablesReady = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_sales_cache (
          channel VARCHAR(32) NOT NULL,
          connection_id VARCHAR(64) NOT NULL DEFAULT '',
          external_id VARCHAR(120) NOT NULL,
          occurred_at DATETIME(3) NOT NULL,
          status VARCHAR(60) NOT NULL DEFAULT '',
          sale_json LONGTEXT NOT NULL,
          changed_at DATETIME(3) NOT NULL,
          seen_at DATETIME(3) NOT NULL,
          PRIMARY KEY (channel, connection_id, external_id),
          KEY idx_marketplace_sales_cache_occurred (occurred_at),
          KEY idx_marketplace_sales_cache_changed (changed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_sales_sync_state (
          source_key VARCHAR(100) NOT NULL PRIMARY KEY,
          last_success_at DATETIME(3) NULL,
          last_deep_at DATETIME(3) NULL,
          last_full_at DATETIME(3) NULL,
          last_error TEXT NULL,
          last_error_at DATETIME(3) NULL,
          updated_at DATETIME(3) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      })().catch((error) => { tablesReady = null; throw error; });
    }
    return tablesReady;
  }

  async function readState(key) {
    const [rows] = await pool.query('SELECT * FROM marketplace_sales_sync_state WHERE source_key = ? LIMIT 1', [key]);
    return rows?.[0] || null;
  }

  async function upsertSales(source, sales, stamp) {
    const rows = sales.map(normalizeSale).filter(Boolean);
    let changed = 0;
    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      const values = chunk.map((row) => [source.channel, source.connectionId || '', row.externalId, row.occurredAt, row.status, row.json, stamp, stamp]);
      const [result] = await pool.query(
        `INSERT INTO marketplace_sales_cache (channel, connection_id, external_id, occurred_at, status, sale_json, changed_at, seen_at)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           changed_at = IF(sale_json <> VALUES(sale_json) OR status <> VALUES(status) OR occurred_at <> VALUES(occurred_at), VALUES(changed_at), changed_at),
           occurred_at = VALUES(occurred_at),
           status = VALUES(status),
           sale_json = VALUES(sale_json),
           seen_at = VALUES(seen_at)`,
        [values],
      );
      changed += Number(result?.affectedRows || 0);
    }
    return { received: rows.length, affected: changed };
  }

  function pickMode(state, current) {
    const full = fromMysqlDate(state?.last_full_at);
    if (!full) return 'full';
    const deep = fromMysqlDate(state?.last_deep_at);
    if (!deep || current - deep.getTime() >= cfg.deepEveryMs) return 'deep';
    return 'recent';
  }

  async function syncSource(source, { mode: forcedMode } = {}) {
    const key = sourceKey(source);
    if (inflight.has(key)) return inflight.get(key);
    const run = (async () => {
      await ensureTables();
      const current = now();
      const state = await readState(key);
      const mode = forcedMode || pickMode(state, current);
      const windowMs = mode === 'full' ? cfg.fullWindowMs : mode === 'deep' ? cfg.deepWindowMs : cfg.recentWindowMs;
      const limit = mode === 'full' ? cfg.fullLimit : mode === 'deep' ? cfg.deepLimit : cfg.recentLimit;
      const startIso = new Date(current - windowMs).toISOString();
      try {
        const sales = await source.load({ limit, startDate: startIso, endDate: '' });
        const stamp = toMysqlDate(now());
        const stats = await upsertSales(source, Array.isArray(sales) ? sales : [], stamp);
        await pool.query(
          `INSERT INTO marketplace_sales_sync_state (source_key, last_success_at, last_deep_at, last_full_at, last_error, last_error_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?)
           ON DUPLICATE KEY UPDATE
             last_success_at = VALUES(last_success_at),
             last_deep_at = COALESCE(VALUES(last_deep_at), last_deep_at),
             last_full_at = COALESCE(VALUES(last_full_at), last_full_at),
             last_error = NULL, last_error_at = NULL,
             updated_at = VALUES(updated_at)`,
          [key, stamp, mode === 'recent' ? null : stamp, mode === 'full' ? stamp : null, stamp],
        );
        return { key, mode, ok: true, ...stats };
      } catch (error) {
        const stamp = toMysqlDate(now());
        const message = String(error?.message || error).slice(0, 500);
        await pool.query(
          `INSERT INTO marketplace_sales_sync_state (source_key, last_error, last_error_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE last_error = VALUES(last_error), last_error_at = VALUES(last_error_at), updated_at = VALUES(updated_at)`,
          [key, message, stamp, stamp],
        ).catch(() => {});
        logger.warn?.(`[marketplace-sales] sync ${key} (${mode}) falhou: ${message}`);
        return { key, mode, ok: false, error: message };
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, run);
    return run;
  }

  async function syncAll() {
    if (syncAllPromise) return syncAllPromise;
    lastSyncAllAt = now();
    syncAllPromise = (async () => {
      const sources = await listSources();
      const results = await Promise.allSettled(sources.map((source) => syncSource(source)));
      return results.map((result) => (result.status === 'fulfilled' ? result.value : { ok: false, error: String(result.reason?.message || result.reason) }));
    })().finally(() => { syncAllPromise = null; });
    return syncAllPromise;
  }

  function syncInBackgroundIfStale() {
    if (syncAllPromise || now() - lastSyncAllAt < cfg.minSyncIntervalMs) return false;
    void syncAll().catch((error) => logger.warn?.(`[marketplace-sales] sync geral falhou: ${error?.message || error}`));
    return true;
  }

  async function listSales({ startDate = '', endDate = '', changedSince = '', limit = cfg.readLimit } = {}) {
    await ensureTables();
    const where = [];
    const params = [];
    const start = startDate ? toMysqlDate(startDate) : null;
    const end = endDate ? toMysqlDate(endDate) : null;
    const since = changedSince ? toMysqlDate(changedSince) : null;
    if (start) { where.push('occurred_at >= ?'); params.push(start); }
    if (end) { where.push('occurred_at <= ?'); params.push(end); }
    if (since) { where.push('changed_at > ?'); params.push(since); }
    const safeLimit = Math.max(1, Math.min(cfg.readLimit, Number(limit) || cfg.readLimit));
    const serverTime = toMysqlDate(now());
    const [rows] = await pool.query(
      `SELECT channel, connection_id, sale_json FROM marketplace_sales_cache
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY occurred_at DESC LIMIT ${safeLimit}`,
      params,
    );
    const sales = [];
    for (const row of rows || []) {
      try {
        sales.push({ ...JSON.parse(row.sale_json), source_channel: row.channel, connection_id: row.connection_id || undefined });
      } catch { /* linha corrompida nao derruba a lista */ }
    }
    const sources = await listSources().catch(() => []);
    const status = [];
    for (const source of sources) {
      const state = await readState(sourceKey(source)).catch(() => null);
      status.push({
        channel: source.channel,
        connection_id: source.connectionId || undefined,
        label: source.label,
        last_success_at: fromMysqlDate(state?.last_success_at)?.toISOString() || null,
        initial_sync_done: Boolean(state?.last_full_at),
        last_error: state?.last_error || null,
        last_error_at: fromMysqlDate(state?.last_error_at)?.toISOString() || null,
      });
    }
    return { sales, server_time: fromMysqlDate(serverTime).toISOString(), sources: status, syncing: Boolean(syncAllPromise) };
  }

  return { ensureTables, syncSource, syncAll, syncInBackgroundIfStale, listSales, sourceKey };
}

module.exports = { createMarketplaceSalesStore, toMysqlDate, fromMysqlDate, DEFAULTS };
