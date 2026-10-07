// Read-only health check for the same WAHA session used by standalone Stories.
function createWhatsAppStatusHealth({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  let cached = null;
  let pending = null;
  async function probe() {
    const checkedAt = new Date(now()).toISOString();
    const session = String(env.WAHA_STATUS_SESSION || '').trim();
    const key = String(env.WAHA_STATUS_API_KEY || '').trim();
    if (!session || !key) return { configured: false, connected: false, state: 'NOT_CONFIGURED', checkedAt };
    try {
      const base = String(env.WAHA_STATUS_SERVER_URL || 'http://127.0.0.1:18082').replace(/\/+$/, '');
      const response = await fetchImpl(`${base}/api/sessions/${encodeURIComponent(session)}`, {
        method: 'GET', headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { configured: true, connected: false, state: 'UNAVAILABLE', httpStatus: response.status, checkedAt };
      const body = await response.json();
      const state = ['WORKING', 'STARTING', 'SCAN_QR_CODE', 'STOPPED', 'FAILED'].includes(body?.status) ? body.status : 'UNKNOWN';
      return { configured: true, connected: state === 'WORKING' && Boolean(body.me), state, checkedAt };
    } catch {
      return { configured: true, connected: false, state: 'UNAVAILABLE', checkedAt };
    }
  }
  return async function getHealth() {
    if (cached && now() - cached.at < 30000) return cached.value;
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
