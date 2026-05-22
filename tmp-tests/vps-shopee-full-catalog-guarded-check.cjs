const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const CONFIRMATION = process.env.CONFIRM_SHOPEE_FULL_CATALOG_READ || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const PAGE_SIZE = Math.min(Math.max(Number(process.env.SHOPEE_FULL_CATALOG_PAGE_SIZE || 100), 1), 100);
const MAX_PAGES = Math.min(Math.max(Number(process.env.SHOPEE_FULL_CATALOG_MAX_PAGES || 1), 1), 200);
const MAX_ITEMS = Math.min(Math.max(Number(process.env.SHOPEE_FULL_CATALOG_MAX_ITEMS || 5), 1), 20000);
const ITEM_STATUS = process.env.SHOPEE_FULL_CATALOG_ITEM_STATUS || 'NORMAL';
const ACTION_PATH = '/api/shopee-catalog?action=get_full_catalog';

function sanitizeShopeeFullCatalogResponse(status, body, options = {}) {
  const response = body && typeof body === 'object' ? body.response : null;
  const rawError = body && typeof body === 'object' ? body.error || null : null;
  const error = rawError && String(rawError).toLowerCase() !== 'success' ? rawError : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const itemList = Array.isArray(response?.item_list) ? response.item_list : [];

  return {
    name: 'catalog_full_catalog',
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    has_response: !!response,
    response_keys: response ? Object.keys(response).slice(0, 8) : [],
    item_count: itemList.length,
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

async function fetchFullCatalog() {
  const query = new URLSearchParams({
    page_size: String(PAGE_SIZE),
    max_pages: String(MAX_PAGES),
    max_items: String(MAX_ITEMS),
    item_status: ITEM_STATUS,
  });
  const response = await fetch(`${BASE_URL}${ACTION_PATH}&${query.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120000),
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
  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeShopeeFullCatalogResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
    });
    console.log(JSON.stringify({ ok: true, full_catalog_executed: false, results: [result] }, null, 2));
    return;
  }

  const { status, body } = await fetchFullCatalog();
  const result = sanitizeShopeeFullCatalogResponse(status, body);
  const ok = result.ok_http && !result.error;
  console.log(JSON.stringify({ ok, full_catalog_executed: true, results: [result] }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
