const BASE_URL = (process.env.VPS_EXTERNAL_CUTOVER_BASE_URL || 'https://www.mercadodovale.com.br').replace(/\/+$/, '');
const LIVE = process.env.VPS_EXTERNAL_CUTOVER_LIVE === 'true';

const checks = [
  {
    name: 'bling_webhook_get',
    path: '/api/bling-webhook',
    expectedStatus: 200,
    expectJson: { ok: true, mode: 'vps-fastify', accepts: 'POST' },
  },
  {
    name: 'mercadopago_webhook_get',
    path: '/api/mercadopago-webhook',
    expectedStatus: 200,
    expectJson: { ok: true, mode: 'vps-fastify', accepts: 'POST' },
  },
  {
    name: 'shopee_webhook_get_rejected',
    path: '/api/shopee-webhook',
    expectedStatus: 405,
    expectJson: { error: 'Method Not Allowed' },
  },
  {
    name: 'bling_callback_missing_code',
    path: '/api/auth/callback/bling',
    expectedStatus: 302,
    expectedLocationIncludes: '/admin/settings/bling?error=missing_code',
  },
  {
    name: 'shopee_callback_missing_params',
    path: '/api/shopee?action=callback',
    expectedStatus: 400,
    expectedTextIncludes: 'Parâmetros ausentes (code, shop_id)',
  },
];

function sanitizeHeaders(headers) {
  return {
    content_type: headers.get('content-type') || '',
    location: headers.get('location') || '',
    server: headers.get('server') || '',
  };
}

function jsonMatches(body, expected) {
  if (!expected) return true;
  if (!body || typeof body !== 'object') return false;
  return Object.entries(expected).every(([key, value]) => body[key] === value);
}

async function runCheck(check) {
  const response = await fetch(`${BASE_URL}${check.path}`, {
    method: 'GET',
    redirect: 'manual',
    headers: { accept: 'application/json,text/html;q=0.8,*/*;q=0.1' },
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let body = null;
  if (contentType.includes('application/json')) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  const headers = sanitizeHeaders(response.headers);
  const ok =
    response.status === check.expectedStatus &&
    jsonMatches(body, check.expectJson) &&
    (!check.expectedLocationIncludes || headers.location.includes(check.expectedLocationIncludes)) &&
    (!check.expectedTextIncludes || text.includes(check.expectedTextIncludes));

  return {
    name: check.name,
    path: check.path,
    status: response.status,
    expected_status: check.expectedStatus,
    headers,
    body_keys: body ? Object.keys(body).sort() : [],
    ok,
  };
}

async function main() {
  if (!LIVE) {
    console.log(JSON.stringify({
      ok: true,
      live_read: false,
      route_probe_sent: false,
      reason: 'missing_VPS_EXTERNAL_CUTOVER_LIVE_true',
    }, null, 2));
    return;
  }

  const results = [];
  for (const check of checks) {
    results.push(await runCheck(check));
  }

  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({
    ok,
    live_read: true,
    route_probe_sent: true,
    base_url: BASE_URL,
    results,
  }, null, 2));

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
