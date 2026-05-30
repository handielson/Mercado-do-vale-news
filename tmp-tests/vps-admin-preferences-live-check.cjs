require('dotenv/config');

const BASE_URL = String(process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || process.env.VITE_VPS_SYNC_KEY || '';

async function run() {
  if (!SYNC_KEY) throw new Error('VPS sync key env missing');
  const response = await fetch(`${BASE_URL}/admin/preferences/finance.filters`, {
    headers: {
      Accept: 'application/json',
      'x-sync-key': SYNC_KEY,
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  const result = {
    ok: response.ok && body?.ok === true && body?.key === 'finance.filters',
    status: response.status,
    key: body?.key || null,
    has_value: body?.value != null,
    updated_at_present: Boolean(body?.updated_at),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
