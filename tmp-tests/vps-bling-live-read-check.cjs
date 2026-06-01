require('dotenv/config');

const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const BLING_ACCESS_TOKEN = process.env.BLING_ACCESS_TOKEN || process.env.VPS_BLING_ACCESS_TOKEN || '';

const readChecks = [
  { name: 'bling_categories', path: '/api/bling?resource=categories&page=1' },
  { name: 'bling_products', path: '/api/bling?resource=products&page=1' },
  { name: 'bling_nfe', path: '/api/bling?resource=nfe&pagina=1' },
  { name: 'bling_nfce', path: '/api/bling?resource=nfce&pagina=1' },
];

async function loadStoredBlingAccessToken() {
  if (!BLING_ACCESS_TOKEN) throw new Error('BLING_ACCESS_TOKEN or VPS_BLING_ACCESS_TOKEN env var missing');
  return BLING_ACCESS_TOKEN;
}

function sanitizeBlingLiveReadResponse(name, status, body) {
  const data = body && typeof body === 'object' ? body.data : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;

  let count = null;
  if (Array.isArray(data)) count = data.length;
  else if (Array.isArray(body?.data?.data)) count = body.data.data.length;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    has_data: !!data,
    data_is_array: Array.isArray(data),
    data_keys: data && !Array.isArray(data) ? Object.keys(data).slice(0, 8) : [],
    count,
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

async function fetchBlingRead(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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
  return { status: response.status, body };
}

async function run() {
  const token = await loadStoredBlingAccessToken();
  const results = [];

  for (const check of readChecks) {
    const { status, body } = await fetchBlingRead(check.path, token);
    results.push(sanitizeBlingLiveReadResponse(check.name, status, body));
  }

  const ok = results.every((result) => result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
