const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_PAYMENT_ID = process.env.MERCADOPAGO_TEST_PAYMENT_ID || '';
const CONFIRMATION = process.env.CONFIRM_MERCADOPAGO_WEBHOOK_SIMULATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_MERCADOPAGO_WEBHOOK_SIMULATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function sanitizeMercadoPagoWebhookSimulationResponse(status, body, options = {}) {
  const response = body && typeof body === 'object' ? body : null;
  const error = response?.error || null;
  const message = response?.message || null;
  const reason = response?.reason || null;
  const debug = response?.debug && typeof response.debug === 'object' ? response.debug : null;

  return {
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || reason || null,
    has_message: !!message,
    message: message ? String(message).slice(0, 80) : null,
    has_error: !!error,
    error: error ? String(error).slice(0, 120) : null,
    debug_step: debug?.step || null,
    debug_has_upstream_status: Number.isFinite(Number(debug?.mercadoPagoStatus)),
  };
}

async function postMercadoPagoWebhookSimulation() {
  const response = await fetch(`${BASE_URL}/api/mercadopago-webhook`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'payment',
      data: {
        id: TEST_PAYMENT_ID,
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
  if (!TEST_PAYMENT_ID) {
    const result = sanitizeMercadoPagoWebhookSimulationResponse(0, null, {
      skipped: true,
      reason: 'missing_MERCADOPAGO_TEST_PAYMENT_ID',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeMercadoPagoWebhookSimulationResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
    });
    console.log(JSON.stringify({ ok: true, webhook_sent: false, results: [result] }, null, 2));
    return;
  }

  const { status, body } = await postMercadoPagoWebhookSimulation();
  const result = sanitizeMercadoPagoWebhookSimulationResponse(status, body);
  const ok = result.ok_http && !result.has_error;
  console.log(JSON.stringify({ ok, webhook_sent: true, results: [result] }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
