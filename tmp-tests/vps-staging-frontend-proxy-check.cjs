const http = require('http');
const https = require('https');

const VPS_ORIGIN = process.env.STAGING_FRONTEND_PROXY_ORIGIN || 'http://76.13.232.162';
const STAGING_HOST = process.env.STAGING_FRONTEND_PROXY_HOST || 'staging.mercadodovale.com.br';
const LIVE_READ = process.env.STAGING_FRONTEND_PROXY_LIVE === 'true';

const CHECKS = [
  { name: 'site_root', path: '/', expected_status: 200, expected_type: /text\/html/i },
  { name: 'admin_products_spa', path: '/admin/products', expected_status: 200, expected_type: /text\/html/i },
  { name: 'vps_proxy_status', path: '/api/vps-proxy?path=%2Fstatus', expected_status: 200, expected_type: /application\/json/i },
  { name: 'vps_proxy_products_read', path: '/api/vps-proxy?path=%2Fproducts%3Flimit%3D1', expected_status: 200, expected_type: /application\/json/i },
  { name: 'vps_proxy_company_settings_blocked', path: '/api/vps-proxy?path=%2Fcompany-settings', expected_status: 403, expected_type: /application\/json/i },
];

function fetchText(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers, timeout: 30000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && location) {
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          fetchText(new URL(location, url).toString(), headers, redirectCount + 1).then(resolve, reject);
          return;
        }
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          body,
          finalUrl: url,
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

function summarizeCheck(check, response) {
  const contentTypeOk = check.expected_type.test(response.contentType);
  const body = String(response.body || '');
  let parsedKeys = [];
  if (/application\/json/i.test(response.contentType)) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsedKeys = Object.keys(parsed).filter((key) => !/token|secret|password|authorization/i.test(key)).slice(0, 10);
      }
    } catch {
      parsedKeys = ['json_parse_failed'];
    }
  }

  return {
    name: check.name,
    path: check.path,
    status: response.status,
    expected_status: check.expected_status,
    content_type: response.contentType,
    content_type_ok: contentTypeOk,
    body_bytes: Buffer.byteLength(body),
    json_keys: parsedKeys,
    ok: response.status === check.expected_status && contentTypeOk,
  };
}

async function main() {
  if (!LIVE_READ) {
    console.log(JSON.stringify({
      ok: true,
      live_read: false,
      reason: 'missing_STAGING_FRONTEND_PROXY_LIVE_true',
      host: STAGING_HOST,
      checks: CHECKS.map(({ name, path, expected_status }) => ({ name, path, expected_status })),
    }, null, 2));
    return;
  }

  const results = [];
  const origin = VPS_ORIGIN.replace(/\/+$/, '');
  for (const check of CHECKS) {
    const response = await fetchText(`${origin}${check.path}`, { Host: STAGING_HOST });
    results.push(summarizeCheck(check, response));
  }

  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({
    ok,
    live_read: true,
    host: STAGING_HOST,
    results,
  }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, live_read: LIVE_READ, host: STAGING_HOST, error: err.message }, null, 2));
  process.exit(1);
});
