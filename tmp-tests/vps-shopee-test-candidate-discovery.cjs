require('dotenv/config');

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || '';

function buildSupabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: 'application/json',
  };
}

async function supabaseSelect(table, query) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase env vars missing');
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: buildSupabaseHeaders(),
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
    const message = body?.message || body?.error || `Supabase HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 160));
  }
  return Array.isArray(body) ? body : [];
}

function looksLikeTestProduct(product) {
  const text = `${product?.name || ''} ${product?.sku || ''}`.toLowerCase();
  return /\b(test|teste|homolog|sandbox|dummy|qa|validacao|validação)\b/.test(text);
}

function sanitizeProductCandidate(product, source, linked = {}) {
  return {
    source,
    product_id: product?.id == null ? null : String(product.id),
    active: String(product?.status || '').toLowerCase() === 'active',
    track_inventory: product?.track_inventory == null ? null : !!product.track_inventory,
    has_stock: Number(product?.stock_quantity || 0) > 0,
    has_price: Number(product?.price_retail || 0) > 0,
    linked_item: !!(product?.shopee_item_id || linked?.shopee_item_id),
    linked_model: !!linked?.shopee_model_id,
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
  const productRows = await supabaseSelect(
    'products',
    [
      'select=id,sku,name,status,track_inventory,stock_quantity,price_retail,shopee_item_id',
      'shopee_item_id=not.is.null',
      'order=updated_at.desc',
      'limit=50',
    ].join('&'),
  );

  let linkedRows = [];
  try {
    linkedRows = await supabaseSelect(
      'shopee_products',
      [
        'select=product_id,shopee_item_id,shopee_model_id',
        'shopee_item_id=not.is.null',
        'limit=50',
      ].join('&'),
    );
  } catch {
    linkedRows = [];
  }

  const linkedProductIds = linkedRows
    .map((row) => row?.product_id)
    .filter((id) => id != null)
    .slice(0, 50);

  let linkedProductRows = [];
  if (linkedProductIds.length > 0) {
    linkedProductRows = await supabaseSelect(
      'products',
      [
        'select=id,sku,name,status,track_inventory,stock_quantity,price_retail,shopee_item_id',
        `id=in.(${linkedProductIds.map((id) => encodeURIComponent(String(id))).join(',')})`,
        'limit=50',
      ].join('&'),
    );
  }

  const linkedByProductId = new Map(
    linkedRows.map((row) => [String(row.product_id), row]),
  );

  const candidates = uniqueByProductId([
    ...productRows.map((product) => sanitizeProductCandidate(product, 'products.shopee_item_id', linkedByProductId.get(String(product.id)))),
    ...linkedProductRows.map((product) => sanitizeProductCandidate(product, 'shopee_products', linkedByProductId.get(String(product.id)))),
  ]).sort((a, b) => Number(b.test_like) - Number(a.test_like));

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
