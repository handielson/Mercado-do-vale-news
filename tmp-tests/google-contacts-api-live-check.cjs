const path = require('node:path');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}

async function main() {
  const key = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || '';
  if (!key) throw new Error('VPS sync key not configured');
  const query = String(process.argv[2] || '558788418553');
  const syncNameIndex = process.argv.indexOf('--sync-name');
  const syncName = syncNameIndex >= 0 ? String(process.argv[syncNameIndex + 1] || '').trim() : '';
  let sync = null;
  if (syncName) {
    const syncResponse = await fetch('https://api.xiaomipetrolina.com.br/google-contacts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': key },
      body: JSON.stringify({ phone: query, name: syncName }),
      signal: AbortSignal.timeout(20000),
    });
    const syncBody = await syncResponse.json().catch(() => ({}));
    sync = { status: syncResponse.status, ok: syncBody.ok === true, action: syncBody.action || null, error: syncBody.error || syncBody.reason || null };
    if (!syncResponse.ok || syncBody.ok !== true) process.exitCode = 1;
  }
  const url = new URL('https://api.xiaomipetrolina.com.br/google-contacts/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  const response = await fetch(url, { headers: { 'x-sync-key': key }, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ sync, search: { status: response.status, configured: body.configured, error: body.error || null, count: Array.isArray(body.data) ? body.data.length : 0 } }, null, 2));
  if (!response.ok || body.configured !== true) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exit(1); });
