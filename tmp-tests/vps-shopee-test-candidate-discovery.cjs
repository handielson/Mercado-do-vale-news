require('dotenv/config');

const BASE_URL = String(process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');

async function fetchVpsProducts(query) {
  const response = await fetch(`${BASE_URL}/products?${query}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parse_error: true, sample: text.slice(0, 160) };
  }
  if (!response.ok) {
    const message = body?.message || body?.error || `VPS HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 160));
  }
  return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
}

function looksLikeTestProduct(product) {
  const text = `${product?.name || ''} ${product?.sku || ''}`.toLowerCase();
  return /\b(test|teste|homolog|sandbox|dummy|qa|validacao|validacao)\b/.test(text);
}

function sanitizeProductCandidate(product, source) {
  return {
    source,
    product_id: product?.id == null ? null : String(product.id),
    active: String(product?.status || '').toLowerCase() === 'active',
    track_inventory: product?.track_inventory == null ? null : !!product.track_inventory,
    has_stock: Number(product?.stock_quantity || 0) > 0,
    has_price: Number(product?.price_retail || 0) > 0,
    linked_item: !!product?.shopee_item_id,
    linked_model: !!product?.shopee_model_id,
    test_like: looksLikeTestProduct(product),
  };
}

function uniqueByProductId(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const key = candidate.product_id || `${candidate.source}:${unique.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

async function run() {
  const productRows = await fetchVpsProducts([
    'status=all',
    'include_parents=true',
    'compact=true',
    'limit=200',
  ].join('&'));

  const candidates = uniqueByProductId(
    productRows
      .filter((product) => product?.shopee_item_id || product?.shopee_model_id)
      .map((product) => sanitizeProductCandidate(product, 'vps.products')),
  ).sort((a, b) => Number(b.test_like) - Number(a.test_like));

  console.log(JSON.stringify({
    ok: true,
    candidate_count: candidates.length,
    test_like_count: candidates.filter((candidate) => candidate.test_like).length,
    candidates: candidates.slice(0, 15),
  }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
