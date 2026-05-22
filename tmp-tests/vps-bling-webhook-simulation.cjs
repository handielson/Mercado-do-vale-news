const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_EVENT = process.env.BLING_TEST_WEBHOOK_EVENT || '';
const TEST_SKU = process.env.BLING_TEST_WEBHOOK_SKU || '';
const TEST_BLING_ID = process.env.BLING_TEST_WEBHOOK_BLING_ID || '';
const TEST_STOCK = process.env.BLING_TEST_WEBHOOK_STOCK || '';
const TEST_NAME = process.env.BLING_TEST_WEBHOOK_NAME || '';
const CONFIRMATION = process.env.CONFIRM_BLING_WEBHOOK_SIMULATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_BLING_WEBHOOK_SIMULATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function sanitizeBlingWebhookSimulationResponse(status, body, options = {}) {
  const response = body && typeof body === 'object' ? body : null;
  const error = response?.error || null;
  const message = response?.message || null;

  return {
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    has_ok_flag: typeof response?.ok === 'boolean',
    ok_flag: typeof response?.ok === 'boolean' ? response.ok : null,
    has_message: !!message,
    has_error: !!error,
    error: error ? String(error).slice(0, 160) : null,
  };
}

function buildBlingWebhookPayload() {
  const product = {};
  if (TEST_BLING_ID) product.id = Number(TEST_BLING_ID) || TEST_BLING_ID;
  if (TEST_SKU) product.codigo = TEST_SKU;
  if (TEST_NAME) product.nome = TEST_NAME;
  if (TEST_STOCK !== '') {
    product.estoque = { saldoFisicoTotal: Number(TEST_STOCK) };
  }

  return {
    event: TEST_EVENT,
    data: {
      produto: product,
    },
  };
}

async function postBlingWebhookSimulation() {
  const response = await fetch(`${BASE_URL}/api/bling-webhook`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildBlingWebhookPayload()),
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
  if (!TEST_EVENT || (!TEST_SKU && !TEST_BLING_ID)) {
    const result = sanitizeBlingWebhookSimulationResponse(0, null, {
      skipped: true,
      reason: !TEST_EVENT ? 'missing_BLING_TEST_WEBHOOK_EVENT' : 'missing_product_identifier',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeBlingWebhookSimulationResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  const { status, body } = await postBlingWebhookSimulation();
  const result = sanitizeBlingWebhookSimulationResponse(status, body);
  const ok = result.ok_http && !result.has_error;
  console.log(JSON.stringify({ ok, webhook_sent: true, results: [result] }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
