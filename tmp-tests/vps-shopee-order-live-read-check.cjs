const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const now = Math.floor(Date.now() / 1000);
const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

function sanitizeShopeeOrderReadResponse(name, status, body, options = {}) {
  const response = body && typeof body === 'object' ? body.response : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /order_sn|buyer|recipient|tracking_number|cpf|phone|address/i;

  let count = null;
  if (Array.isArray(response?.order_list)) count = response.order_list.length;
  else if (Array.isArray(response?.order)) count = response.order.length;
  else if (Array.isArray(response?.tracking_info)) count = response.tracking_info.length;
  else if (Array.isArray(response?.order_income)) count = response.order_income.length;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    has_response: !!response,
    response_keys: response ? Object.keys(response).filter((key) => !sensitiveKeyPattern.test(key)).slice(0, 8) : [],
    count,
    skipped: !!options.skipped,
    reason: options.reason || null,
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

function extractFirstShopeeOrderSn(body) {
  const response = body && typeof body === 'object' ? body.response : null;
  if (!response || typeof response !== 'object') return null;

  const candidates = [
    response.order_list,
    response.order,
    response.orders,
  ];

  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    const orderSn = list.find((order) => order && typeof order === 'object' && order.order_sn)?.order_sn;
    if (orderSn) return String(orderSn);
  }

  return null;
}

async function fetchShopeeOrderRead(path) {
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
  const orderListPath = `/api/shopee-actions?action=get_order_list&page_size=5&time_range_field=create_time&time_from=${fifteenDaysAgo}&time_to=${now}`;
  const orderList = await fetchShopeeOrderRead(orderListPath);
  results.push(sanitizeShopeeOrderReadResponse('actions_order_list', orderList.status, orderList.body));

  const discoveredOrderSn = extractFirstShopeeOrderSn(orderList.body);
  if (discoveredOrderSn) {
    const detailChecks = [
      { name: 'actions_order_detail', path: `/api/shopee-actions?action=get_order_detail&order_sn_list=${encodeURIComponent(discoveredOrderSn)}` },
      { name: 'actions_tracking_info', path: `/api/shopee-actions?action=get_tracking_info&order_sn=${encodeURIComponent(discoveredOrderSn)}` },
      { name: 'actions_escrow_detail', path: `/api/shopee-actions?action=get_escrow_detail&order_sn=${encodeURIComponent(discoveredOrderSn)}` },
    ];

    for (const check of detailChecks) {
      const { status, body } = await fetchShopeeOrderRead(check.path);
      results.push(sanitizeShopeeOrderReadResponse(check.name, status, body));
    }
  } else {
    for (const name of ['actions_order_detail', 'actions_tracking_info', 'actions_escrow_detail']) {
      results.push(sanitizeShopeeOrderReadResponse(name, 0, null, {
        skipped: true,
        reason: 'no_order_sn_discovered_in_last_15_days',
      }));
    }
  }

  const ok = results.every((result) => result.skipped || result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, discovered_order: !!discoveredOrderSn, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
