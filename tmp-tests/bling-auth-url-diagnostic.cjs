const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile('.env.vps.local');

const API_BASE = String(process.env.VPS_API_BASE_URL || process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || process.env.VITE_VPS_SYNC_KEY || '';

async function run() {
  if (!SYNC_KEY) throw new Error('Missing VPS sync key');

  const response = await fetch(`${API_BASE}/company-settings`, {
    headers: { Accept: 'application/json', 'x-sync-key': SYNC_KEY },
    signal: AbortSignal.timeout(20000),
  });
  const settings = await response.json();
  const redirectUri = settings.bling_callback_url || 'https://www.mercadodovale.com.br/api/auth/callback/bling';
  const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', String(settings.bling_client_id || ''));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', 'bling_oauth');

  const parsedRedirect = new URL(redirectUri);
  console.log(JSON.stringify({
    ok: response.ok && Boolean(settings.bling_client_id) && parsedRedirect.pathname === '/api/auth/callback/bling',
    auth_host: authUrl.host,
    auth_path: authUrl.pathname,
    client_id_prefix: String(settings.bling_client_id || '').slice(0, 8),
    redirect_uri: redirectUri,
    redirect_host: parsedRedirect.host,
    redirect_path: parsedRedirect.pathname,
    has_client_secret: Boolean(settings.bling_client_secret),
    has_access_token: Boolean(settings.bling_access_token),
    has_refresh_token: Boolean(settings.bling_refresh_token),
  }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
