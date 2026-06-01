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
const SITE_BASE = String(process.env.PUBLIC_SITE_BASE_URL || 'https://www.mercadodovale.com.br').replace(/\/+$/, '');
const SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || process.env.VITE_VPS_SYNC_KEY || '';
const CLEAR_INVALID = process.env.BLING_CLEAR_INVALID === 'true';

function summarizeSettings(settings) {
  const expiresAt = settings?.bling_token_expires_at ? new Date(settings.bling_token_expires_at) : null;
  return {
    has_client_id: Boolean(settings?.bling_client_id),
    has_client_secret: Boolean(settings?.bling_client_secret),
    has_access_token: Boolean(settings?.bling_access_token),
    has_refresh_token: Boolean(settings?.bling_refresh_token),
    callback_url_host: settings?.bling_callback_url ? new URL(settings.bling_callback_url).host : null,
    callback_url_path: settings?.bling_callback_url ? new URL(settings.bling_callback_url).pathname : null,
    token_expires_at: settings?.bling_token_expires_at || null,
    token_is_expired: expiresAt ? expiresAt.getTime() <= Date.now() : null,
  };
}

function sanitizeExchangeBody(body) {
  const debug = body?.debug;
  return {
    error: body?.error || body?.message || null,
    debug_title: debug?.title || null,
    debug_scope: debug?.scope || null,
    debug_step: debug?.step || null,
    upstream_status: debug?.upstreamStatus || null,
    raw_message: debug?.rawMessage ? String(debug.rawMessage).slice(0, 240) : null,
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parse_error: true, sample: text.slice(0, 160) };
  }
  return { status: response.status, ok: response.ok, body };
}

async function run() {
  if (!SYNC_KEY) throw new Error('Missing VPS sync key');

  const settingsResponse = await request(`${API_BASE}/company-settings`, {
    headers: { 'x-sync-key': SYNC_KEY },
  });
  const settings = settingsResponse.body || {};
  const summary = summarizeSettings(settings);

  let refresh = null;
  let cleared = false;
  if (summary.has_client_id && summary.has_client_secret && summary.has_refresh_token) {
    const response = await request(`${SITE_BASE}/api/bling?resource=exchange`, {
      method: 'POST',
      body: JSON.stringify({
        code: settings.bling_refresh_token,
        client_id: settings.bling_client_id,
        client_secret: settings.bling_client_secret,
        redirect_uri: 'refresh',
        grant_type: 'refresh_token',
      }),
    });
    refresh = {
      status: response.status,
      ok: response.ok,
      has_access_token: Boolean(response.body?.access_token),
      has_refresh_token: Boolean(response.body?.refresh_token),
      ...sanitizeExchangeBody(response.body || {}),
    };

    if (CLEAR_INVALID && !response.ok && String(refresh.raw_message || refresh.error || '').toLowerCase().includes('invalid refresh token')) {
      const clearResponse = await request(`${API_BASE}/company-settings`, {
        method: 'PATCH',
        headers: { 'x-sync-key': SYNC_KEY },
        body: JSON.stringify({
          bling_access_token: null,
          bling_refresh_token: null,
          bling_token_expires_at: null,
        }),
      });
      cleared = clearResponse.ok;
    }
  }

  const ok = settingsResponse.ok && (Boolean(refresh?.ok) || (CLEAR_INVALID && cleared));
  console.log(JSON.stringify({
    ok,
    mode: CLEAR_INVALID ? 'clear-invalid' : 'diagnostic',
    settings_status: settingsResponse.status,
    settings: summary,
    refresh,
    cleared,
  }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
