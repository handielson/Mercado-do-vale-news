require('dotenv/config');

const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const BLING_ACCESS_TOKEN = process.env.BLING_ACCESS_TOKEN || process.env.VPS_BLING_ACCESS_TOKEN || '';

async function loadStoredBlingAccessToken() {
  if (!BLING_ACCESS_TOKEN) throw new Error('BLING_ACCESS_TOKEN or VPS_BLING_ACCESS_TOKEN env var missing');
  return BLING_ACCESS_TOKEN;
}

function extractFirstId(body) {
  const data = body && typeof body === 'object' ? body.data : null;
  const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const first = list.find((item) => item && typeof item === 'object' && item.id != null);
  return first ? String(first.id) : null;
}

function sanitizeBlingDetailReadResponse(name, status, body, options = {}) {
  const data = body && typeof body === 'object' ? body.data || (body.id != null ? body : null) : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /nome|codigo|sku|cliente|contato|documento|cpf|cnpj|email|fone|telefone|endereco|nfe|nfce|numero|chave/i;

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

  const products = await fetchBlingRead('/api/bling?resource=products&page=1', token);
  const productId = extractFirstId(products.body);
  if (productId) {
    const detail = await fetchBlingRead(`/api/bling?resource=product-detail&id=${encodeURIComponent(productId)}`, token);
    results.push(sanitizeBlingDetailReadResponse('bling_product_detail', detail.status, detail.body));
  } else {
    results.push(sanitizeBlingDetailReadResponse('bling_product_detail', 0, null, {
      skipped: true,
      reason: 'no_product_id_discovered',
    }));
  }

  const nfe = await fetchBlingRead('/api/bling?resource=nfe&pagina=1', token);
  const nfeId = extractFirstId(nfe.body);
  if (nfeId) {
    const detail = await fetchBlingRead(`/api/bling?resource=nf-detail&tipo=nfe&id=${encodeURIComponent(nfeId)}`, token);
    results.push(sanitizeBlingDetailReadResponse('bling_nfe_detail', detail.status, detail.body));
  } else {
    results.push(sanitizeBlingDetailReadResponse('bling_nfe_detail', 0, null, {
      skipped: true,
      reason: 'no_nfe_id_discovered',
    }));
  }

  const ok = results.every((result) => result.skipped || result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, discovered_product: !!productId, discovered_nfe: !!nfeId, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
