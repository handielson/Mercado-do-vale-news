const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_ORDER_SN = process.env.SHOPEE_TEST_ORDER_SN || '';
const CONFIRMATION = process.env.CONFIRM_SHOPEE_TEST_SHIP_ORDER || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHOPEE_TEST_SHIP_ORDER';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function sanitizeShopeeShipOrderResponse(name, status, body, options = {}) {
  const response = body && typeof body === 'object' ? body.response : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /order_sn|package_number|tracking_number|pickup|address|phone|buyer/i;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    has_response: !!response,
    response_keys: response ? Object.keys(response).filter((key) => !sensitiveKeyPattern.test(key)).slice(0, 8) : [],
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

async function postShopeeShipOrder() {
  const response = await fetch(`${BASE_URL}/api/shopee-actions?action=ship_order`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order_sn: TEST_ORDER_SN }),
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
  if (!TEST_ORDER_SN) {
    const result = sanitizeShopeeShipOrderResponse('actions_ship_order', 0, null, {
      skipped: true,
      reason: 'missing_SHOPEE_TEST_ORDER_SN',
    });
    console.log(JSON.stringify({ ok: true, mutation_executed: false, results: [result] }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeShopeeShipOrderResponse('actions_ship_order', 0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
    });
    console.log(JSON.stringify({ ok: true, mutation_executed: false, results: [result] }, null, 2));
    return;
  }

  const { status, body } = await postShopeeShipOrder();
  const result = sanitizeShopeeShipOrderResponse('actions_ship_order', status, body);
  const ok = result.ok_http && !result.error;
  console.log(JSON.stringify({ ok, mutation_executed: true, results: [result] }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
