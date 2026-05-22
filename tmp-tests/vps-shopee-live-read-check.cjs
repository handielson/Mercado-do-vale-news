const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';

const checks = [
  { name: 'actions_shop_info', path: '/api/shopee-actions?action=get_shop_info' },
  { name: 'catalog_shop_info', path: '/api/shopee-catalog?action=shop_info' },
  { name: 'catalog_categories', path: '/api/shopee-catalog?action=categories&page_size=5' },
  { name: 'catalog_logistics_channels', path: '/api/shopee-catalog?action=logistics_channel_list' },
  { name: 'catalog_item_list', path: '/api/shopee-catalog?action=get_item_list&page_size=5&item_status=NORMAL' },
];

function sanitizeShopeeLiveReadResponse(name, status, body) {
  const response = body && typeof body === 'object' ? body.response : null;
  const error = body && typeof body === 'object' ? body.error || body.message || body.request_id && body.error : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;

  let count = null;
  if (Array.isArray(response?.category_list)) count = response.category_list.length;
  else if (Array.isArray(response?.logistics_channel_list)) count = response.logistics_channel_list.length;
  else if (Array.isArray(response?.shop_list)) count = response.shop_list.length;
  else if (Array.isArray(response?.item)) count = response.item.length;
  else if (Array.isArray(response?.item_list)) count = response.item_list.length;
  else if (Array.isArray(response?.item_base_info_list)) count = response.item_base_info_list.length;
  else if (Array.isArray(response?.model_list)) count = response.model_list.length;
  else if (Array.isArray(response?.model)) count = response.model.length;
  else if (Array.isArray(body?.data)) count = body.data.length;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    has_response: !!response,
    response_keys: response ? Object.keys(response).slice(0, 8) : [],
    count,
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

function extractFirstShopeeItemId(body) {
  const response = body && typeof body === 'object' ? body.response : null;
  if (!response || typeof response !== 'object') return null;

  const candidates = [
    response.item_list,
    response.item,
    response.items,
    response.item_base_info_list,
  ];

  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    const itemId = list.find((item) => item && typeof item === 'object' && item.item_id)?.item_id;
    if (itemId) return String(itemId);
  }

  return null;
}

async function fetchShopeeRead(path) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
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
  return { status: response.status, body };
}

async function run() {
  const results = [];
  let discoveredItemId = null;

  for (const check of checks) {
    const { status, body } = await fetchShopeeRead(check.path);
    results.push(sanitizeShopeeLiveReadResponse(check.name, status, body));
    if (check.name === 'catalog_item_list') discoveredItemId = extractFirstShopeeItemId(body);
  }

  if (discoveredItemId) {
    const detailChecks = [
      { name: 'catalog_item_base_info', path: `/api/shopee-catalog?action=get_item_base_info&item_id_list=${encodeURIComponent(discoveredItemId)}` },
      { name: 'catalog_model_list', path: `/api/shopee-catalog?action=get_model_list&item_id=${encodeURIComponent(discoveredItemId)}` },
    ];

    for (const check of detailChecks) {
      const { status, body } = await fetchShopeeRead(check.path);
      results.push(sanitizeShopeeLiveReadResponse(check.name, status, body));
    }
  } else {
    results.push(
      { name: 'catalog_item_base_info', skipped: true, reason: 'no_item_id_discovered' },
      { name: 'catalog_model_list', skipped: true, reason: 'no_item_id_discovered' },
    );
  }

  const ok = results.every((result) => result.skipped || result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, discovered_item: !!discoveredItemId, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
