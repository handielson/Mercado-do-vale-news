const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_CALLBACK_URL = 'https://www.mercadodovale.com.br/api/auth/callback/bling';
const OLD_PROTECTED_CALLBACK_PATH = '/admin/settings/bling/callback';

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

const BASE_URL = String(process.env.VPS_API_BASE_URL || process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || process.env.VITE_VPS_SYNC_KEY || '';
const SHOULD_FIX = process.env.BLING_CALLBACK_FIX === 'true';

function summarizeUrl(value) {
  if (!value) {
    return {
      present: false,
      host: null,
      path: null,
      matches_expected: false,
      uses_old_protected_path: false,
    };
  }

  try {
    const parsed = new URL(value);
    return {
      present: true,
      host: parsed.host,
      path: parsed.pathname,
      matches_expected: value === EXPECTED_CALLBACK_URL,
      uses_old_protected_path: parsed.pathname === OLD_PROTECTED_CALLBACK_PATH,
    };
  } catch {
    return {
      present: true,
      host: null,
      path: null,
      matches_expected: false,
      uses_old_protected_path: String(value).includes(OLD_PROTECTED_CALLBACK_PATH),
      invalid_url: true,
    };
  }
}

async function api(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'x-sync-key': SYNC_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: response.status, ok: response.ok, body };
}

async function run() {
  if (!SYNC_KEY) throw new Error('Missing VPS_SYNC_KEY/SYNC_SECRET/VITE_VPS_SYNC_KEY');

  const before = await api('/company-settings');
  const beforeSummary = summarizeUrl(before.body?.bling_callback_url);
  const result = {
    ok: before.ok,
    mode: SHOULD_FIX ? 'fix' : 'check',
    status: before.status,
    expected_callback_url: EXPECTED_CALLBACK_URL,
    before: beforeSummary,
    fixed: false,
    patch_status: null,
    patch_response_keys: [],
    patch_error: null,
    after: null,
  };

  if (!before.ok) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const needsFix = !beforeSummary.matches_expected;
  if (SHOULD_FIX && needsFix) {
    const patch = await api('/company-settings', {
      method: 'PATCH',
      body: JSON.stringify({ bling_callback_url: EXPECTED_CALLBACK_URL }),
    });
    result.patch_status = patch.status;
    result.patch_response_keys = patch.body && typeof patch.body === 'object' ? Object.keys(patch.body).sort() : [];
    result.patch_error = patch.body?.error || patch.body?.message || null;
    result.fixed = patch.ok;
    const after = await api('/company-settings');
    result.after = summarizeUrl(after.body?.bling_callback_url);
    result.ok = patch.ok && after.ok && result.after.matches_expected;
  } else {
    result.ok = beforeSummary.matches_expected;
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
