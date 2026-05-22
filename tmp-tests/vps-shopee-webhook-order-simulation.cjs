const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_ORDER_SN = process.env.SHOPEE_TEST_WEBHOOK_ORDER_SN || '';
const TEST_STATUS = process.env.SHOPEE_TEST_WEBHOOK_STATUS || '';
const TEST_SHOP_ID = process.env.SHOPEE_TEST_WEBHOOK_SHOP_ID || '0';
const CONFIRMATION = process.env.CONFIRM_SHOPEE_WEBHOOK_ORDER_SIMULATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHOPEE_WEBHOOK_ORDER_SIMULATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function sanitizeShopeeWebhookSimulationResponse(status, body, options = {}) {
  const message = body && typeof body === 'object' ? body.message || null : null;
  const error = body && typeof body === 'object' ? body.error || null : null;

  return {
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    webhook_acknowledged: message === 'success',
    has_error: !!error,
    error: error ? String(error).slice(0, 160) : null,
  };
}

async function postShopeeWebhookSimulation() {
  const response = await fetch(`${BASE_URL}/api/shopee-webhook`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: 3,
      shop_id: Number(TEST_SHOP_ID) || 0,
      data: {
        ordersn: TEST_ORDER_SN,
        status: TEST_STATUS,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parse_error: true };
  }
  return { status: response.status, body };
}

async function run() {
  if (!TEST_ORDER_SN || !TEST_STATUS) {
    const result = sanitizeShopeeWebhookSimulationResponse(0, null, {
      skipped: true,
      reason: !TEST_ORDER_SN ? 'missing_SHOPEE_TEST_WEBHOOK_ORDER_SN' : 'missing_SHOPEE_TEST_WEBHOOK_STATUS',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeShopeeWebhookSimulationResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  const { status, body } = await postShopeeWebhookSimulation();
  const result = sanitizeShopeeWebhookSimulationResponse(status, body);
  const ok = result.ok_http && result.webhook_acknowledged && !result.has_error;
  console.log(JSON.stringify({ ok, webhook_sent: true, results: [result] }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
