require('dotenv/config');

const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || '';

async function loadStoredBlingAccessToken() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars missing');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/company_settings?select=bling_access_token&limit=1`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => []);
  const token = Array.isArray(body) ? body[0]?.bling_access_token : null;
  if (!response.ok || !token) throw new Error('Bling token missing');
  return String(token);
}

function extractFirstId(body) {
  const data = body && typeof body === 'object' ? body.data : null;
  const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const first = list.find((item) => item && typeof item === 'object' && item.id != null);
  return first ? String(first.id) : null;
}

function sanitizeBlingStockReadResponse(name, status, body, options = {}) {
  const data = body && typeof body === 'object' ? body.data : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /produto|codigo|sku|nome|descricao|deposito|saldo|quantidade|estoque|valor/i;

  let count = null;
  if (Array.isArray(data)) count = data.length;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    skipped: !!options.skipped,
    reason: options.reason || null,
    has_data: !!data,
    data_is_array: Array.isArray(data),
    data_keys: data && !Array.isArray(data)
      ? Object.keys(data).filter((key) => !sensitiveKeyPattern.test(key)).slice(0, 8)
      : [],
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const token = await loadStoredBlingAccessToken();
  const results = [];

  const stockList = await fetchBlingRead('/api/bling?resource=stock&page=1', token);
  results.push(sanitizeBlingStockReadResponse('bling_stock_list', stockList.status, stockList.body));

  await delay(5000);
  const products = await fetchBlingRead('/api/bling?resource=products&page=1', token);
  const productId = extractFirstId(products.body);

  if (productId) {
    await delay(5000);
    const filtered = await fetchBlingRead(`/api/bling?resource=stock&page=1&idsProdutos[]=${encodeURIComponent(productId)}`, token);
    results.push(sanitizeBlingStockReadResponse('bling_stock_filtered', filtered.status, filtered.body));
  } else {
    results.push(sanitizeBlingStockReadResponse('bling_stock_filtered', 0, null, {
      skipped: true,
      reason: 'no_product_id_discovered',
    }));
  }

  const ok = results.every((result) => result.skipped || result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, discovered_product: !!productId, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
