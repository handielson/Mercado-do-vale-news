const http = require('http');
const https = require('https');

const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const LIVE_READ = process.env.OAUTH_PREFLIGHT_LIVE === 'true';

const CHECKS = [
  {
    name: 'bling_callback_missing_code',
    method: 'GET',
    path: '/api/auth/callback/bling',
    expectedStatus: 302,
  },
  {
    name: 'bling_exchange_missing_credentials',
    method: 'POST',
    path: '/api/bling?resource=exchange',
    body: {},
    expectedStatus: 400,
  },
  {
    name: 'shopee_callback_missing_params',
    method: 'GET',
    path: '/api/shopee?action=callback',
    expectedStatus: 400,
  },
  {
    name: 'shopee_auth_url_generation',
    method: 'GET',
    path: '/api/shopee?action=auth',
    expectedStatus: 200,
  },
];

function requestText(method, url, body, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const payload = body == null ? null : JSON.stringify(body);
    const req = client.request(url, {
      method,
      timeout: 30000,
      headers: payload ? {
        Accept: 'application/json,text/html',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      } : {
        Accept: 'application/json,text/html',
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
      });
      res.on('end', () => {
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && location && redirectCount < 0) {
          requestText(method, new URL(location, url).toString(), body, redirectCount + 1).then(resolve, reject);
          return;
        }
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          location: location || '',
          body: text,
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function sanitizeOAuthPreflightResult(check, response) {
  const json = parseJson(response.body);
  const authUrl = json && typeof json.url === 'string' ? json.url : '';
  let authHost = null;
  let authPath = null;
  let redirectHost = null;
  if (authUrl) {
    try {
      const parsed = new URL(authUrl);
      authHost = parsed.host;
      authPath = parsed.pathname;
      const redirect = parsed.searchParams.get('redirect');
      if (redirect) redirectHost = new URL(redirect).host;
    } catch {
      authHost = 'invalid-url';
    }
  }

  return {
    name: check.name,
    method: check.method,
    path: check.path,
    status: response.status,
    expected_status: check.expectedStatus,
    content_type: response.contentType,
    has_redirect: !!response.location,
    redirect_path: response.location ? new URL(response.location, BASE_URL).pathname : null,
    has_auth_url: !!authUrl,
    auth_host: authHost,
    auth_path: authPath,
    redirect_host: redirectHost,
    error: json?.error ? String(json.error).slice(0, 120) : null,
    ok: response.status === check.expectedStatus,
  };
}

async function main() {
  if (!LIVE_READ) {
    console.log(JSON.stringify({
      ok: true,
      live_read: false,
      reason: 'missing_OAUTH_PREFLIGHT_LIVE_true',
      checks: CHECKS.map(({ name, method, path, expectedStatus }) => ({ name, method, path, expected_status: expectedStatus })),
    }, null, 2));
    return;
  }

  const base = BASE_URL.replace(/\/+$/, '');
  const results = [];
  for (const check of CHECKS) {
    const response = await requestText(check.method, `${base}${check.path}`, check.body);
    results.push(sanitizeOAuthPreflightResult(check, response));
  }

  const ok = results.every((result) => result.ok)
    && results.find((result) => result.name === 'shopee_auth_url_generation')?.has_auth_url === true;
  console.log(JSON.stringify({ ok, live_read: true, results }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, live_read: LIVE_READ, error: err.message }, null, 2));
  process.exit(1);
});
