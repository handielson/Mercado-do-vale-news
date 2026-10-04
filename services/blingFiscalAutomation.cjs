const { saveBlingFiscalDocuments } = require('./blingFiscalPersistence.cjs');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const dateText = date => date.toISOString().slice(0, 10);
function syncPeriods(now, lookbackDays = 90) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookbackDays);
  const periods = [];
  let cursor = start;
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12));
    const to = monthEnd < end ? monthEnd : end;
    periods.push({ from: dateText(cursor), to: dateText(to) });
    cursor = new Date(to); cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return periods.reverse(); // Keep today's invoices current even during historical recovery.
}

function createBlingFiscalAutomation({ pool, fetchDocuments, saveDocuments = saveBlingFiscalDocuments, env = process.env, now = () => new Date(), logger = console }) {
  const enabled = () => env.MDV_COMPANY_FISCAL_ENABLED === '1' && env.MDV_BLING_FISCAL_SYNC_ENABLED !== '0';
  const status = { running: false, lastAttemptAt: null, lastSuccessAt: null, state: 'waiting', imported: 0 };
  let timer;
  const getStatus = () => ({ ...status, enabled: enabled(), intervalMinutes: 15, lookbackDays: 90 });
  const tick = async () => {
    if (!enabled()) { status.state = 'disabled'; return getStatus(); }
    if (status.running) return getStatus();
    status.running = true; status.lastAttemptAt = now().toISOString(); status.imported = 0;
    let db, locked = false;
    try {
      db = await pool.getConnection();
      const [locks] = await db.query("SELECT GET_LOCK('mdv_bling_fiscal_sync',0) AS acquired");
      locked = Number(locks[0]?.acquired) === 1;
      if (!locked) { status.state = 'busy'; return { ...getStatus(), running: false }; }
      const [settings] = await db.query('SELECT id,bling_access_token FROM company_settings LIMIT 1');
      if (!settings[0]?.bling_access_token) { status.state = 'disconnected'; return { ...getStatus(), running: false }; }
      const [profiles] = await db.query('SELECT id,cnpj FROM company_fiscal_profiles WHERE BINARY settings_id=BINARY ? LIMIT 1', [settings[0].id]);
      if (!profiles[0]) { status.state = 'missing_profile'; return { ...getStatus(), running: false }; }
      const profile = profiles[0];
      const periods = syncPeriods(now());
      const [known] = await db.query(`SELECT d.source_reference,d.model,d.status,(x.document_id IS NOT NULL) AS has_xml
        FROM company_fiscal_documents d LEFT JOIN company_fiscal_document_xmls x ON BINARY x.document_id=BINARY d.id AND BINARY x.profile_id=BINARY d.profile_id
        WHERE d.profile_id=? AND d.source='bling_import' AND d.issued_at>=?`, [profile.id, periods[periods.length - 1].from]);
      const index = new Map(known.map(d => [`${d.model}:${d.source_reference}`, d]));
      const skipDocument = (type, item) => {
        const saved = index.get(`${type === 'nfce' ? '65' : '55'}:${item.id}`);
        const statusMatches = saved?.status === (Number(item.situacao) === 2 ? 'cancelled' : 'authorized');
        return Boolean(saved?.has_xml && (statusMatches || saved.status === 'cancelled'));
      };
      for (const { from, to } of periods) {
        const documents = await fetchDocuments({ headers: {} }, { from, to, includeXml: true, maxDocuments: 500, skipDocument });
        if (documents.length) {
          const saved = await saveDocuments(pool, { profile, from, to, documents, actor: 'bling-fiscal-auto-sync', automatic: true, connection: db });
          status.imported += saved.imported;
        }
      }
      status.lastSuccessAt = now().toISOString(); status.state = 'ok';
      logger.info('[bling-fiscal-sync]', JSON.stringify({ state: status.state, imported: status.imported }));
    } catch (error) {
      status.state = 'error';
      // External error messages may contain credentials or customer information.
      logger.error('[bling-fiscal-sync] failed', JSON.stringify({ code: error.code || 'sync_failed', statusCode: error.statusCode || null }));
    } finally {
      if (locked) { try { await db.query("SELECT RELEASE_LOCK('mdv_bling_fiscal_sync')"); } catch {} }
      db?.release(); status.running = false;
    }
    return getStatus();
  };
  const start = () => {
    if (timer || !enabled()) return;
    void tick();
    timer = setInterval(() => void tick(), DEFAULT_INTERVAL_MS); timer.unref?.();
  };
  const stop = () => { clearInterval(timer); timer = undefined; };
  return { tick, start, stop, getStatus };
}

module.exports = { createBlingFiscalAutomation, syncPeriods };
