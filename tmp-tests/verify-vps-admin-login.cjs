const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const baseUrl = String(
  process.env.VITE_VPS_BASE_URL ||
  process.env.VPS_BASE_URL ||
  'https://api.xiaomipetrolina.com.br'
).replace(/\/+$/, '');

const email =
  process.env.MDV_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  process.env.VPS_ADMIN_EMAIL ||
  process.env.DEFAULT_ADMIN_EMAIL;
const password =
  process.env.MDV_ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  process.env.VPS_ADMIN_PASSWORD ||
  process.env.DEFAULT_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('Missing local MDV_ADMIN_EMAIL/MDV_ADMIN_PASSWORD for verification');
}

(async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    email: data?.user?.email || data?.customer?.email || null,
    customer_type: data?.customer?.customer_type || null,
    token_present: Boolean(data?.token),
    error: response.ok ? null : data?.error || response.statusText,
  }, null, 2));
  if (!response.ok || data?.customer?.customer_type !== 'ADMIN' || !data?.token) {
    process.exit(1);
  }
})();
