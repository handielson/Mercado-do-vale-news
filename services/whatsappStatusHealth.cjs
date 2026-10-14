// Read-only health check for the same WAHA session used by standalone Stories.
function createWhatsAppStatusHealth({ env = process.env, fetchImpl = fetch, now = Date.now, cacheMs = 30000 } = {}) {
  let cached = null;
  let pending = null;
  async function probe() {
    const checkedAt = new Date(now()).toISOString();
    const session = String(env.WAHA_STATUS_SESSION || '').trim();
    const key = String(env.WAHA_STATUS_API_KEY || '').trim();
    let readingStatus = false;
    if (!session || !key) return { configured: false, connected: false, state: 'NOT_CONFIGURED', checkedAt };
    try {
      const base = String(env.WAHA_STATUS_SERVER_URL || 'http://127.0.0.1:18082').replace(/\/+$/, '');
      const response = await fetchImpl(`${base}/api/sessions/${encodeURIComponent(session)}`, {
        method: 'GET', headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { configured: true, connected: false, state: 'UNAVAILABLE', httpStatus: response.status, checkedAt };
      const body = await response.json();
      const state = ['WORKING', 'STARTING', 'SCAN_QR_CODE', 'STOPPED', 'FAILED'].includes(body?.status) ? body.status : 'UNKNOWN';
      if (state !== 'WORKING' || !body.me) return { configured: true, connected: false, state, checkedAt };
      // WORKING is session metadata; a hung browser can still report it.
      // Exercise the same status chat read used for reconciliation, without sending.
      readingStatus = true;
      const messages = await fetchImpl(`${base}/api/${encodeURIComponent(session)}/chats/status%40broadcast/messages?limit=1&downloadMedia=false`, {
        method: 'GET', headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8000),
      });
      if (!messages.ok) {
        // WPP may not have created this virtual chat after a fresh sync.
        // Check another browser-backed read only for that exact provider error;
        // timeouts and other status failures must continue to block sending.
        const errorBody = await messages.json().catch(() => null);
        const message = String(errorBody?.exception?.message || errorBody?.message || '');
        if (messages.status !== 500 || !/^Chat not found for status@broadcast(?:\n|$)/.test(message)) {
          return { configured: true, connected: false, state: 'STATUS_UNAVAILABLE', httpStatus: messages.status, checkedAt };
        }
        const chats = await fetchImpl(`${base}/api/${encodeURIComponent(session)}/chats?limit=1&offset=0`, {
          method: 'GET', headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8000),
        });
        if (!chats.ok || !Array.isArray(await chats.json())) return { configured: true, connected: false, state: 'STATUS_UNAVAILABLE', checkedAt };
        return { configured: true, connected: true, state, checkedAt, statusRead: 'CHAT_NOT_INITIALIZED' };
      }
      if (!Array.isArray(await messages.json())) return { configured: true, connected: false, state: 'STATUS_UNAVAILABLE', checkedAt };
      return { configured: true, connected: true, state, checkedAt };
    } catch {
      return { configured: true, connected: false, state: readingStatus ? 'STATUS_UNAVAILABLE' : 'UNAVAILABLE', checkedAt };
    }
  }
  return async function getHealth() {
    if (cached && now() - cached.at < cacheMs) return cached.value;
    if (!pending) pending = probe().then(value => { cached = { at: now(), value }; return value; }).finally(() => { pending = null; });
    return pending;
  };
}

function registerWhatsAppStatusHealthRoute(app, requireAdminBearerToken, dependencies) {
  const getHealth = createWhatsAppStatusHealth(dependencies);
  app.get('/admin/whatsapp-status-health', { preHandler: requireAdminBearerToken }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return getHealth();
  });
}
module.exports = { createWhatsAppStatusHealth, registerWhatsAppStatusHealthRoute };
