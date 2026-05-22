const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_PROVIDER = process.env.SHIPPING_TEST_PROVIDER || '';
const TEST_FROM_CEP = process.env.SHIPPING_TEST_FROM_CEP || '';
const TEST_TO_CEP = process.env.SHIPPING_TEST_TO_CEP || '';
const TEST_TOKEN = process.env.SHIPPING_TEST_TOKEN || '';
const CONFIRMATION = process.env.CONFIRM_SHIPPING_QUOTE_SIMULATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHIPPING_QUOTE_SIMULATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const DEFAULT_PACKAGE = {
  weight_g: Number(process.env.SHIPPING_TEST_WEIGHT_G || 300),
  height_cm: Number(process.env.SHIPPING_TEST_HEIGHT_CM || 10),
  width_cm: Number(process.env.SHIPPING_TEST_WIDTH_CM || 15),
  length_cm: Number(process.env.SHIPPING_TEST_LENGTH_CM || 20),
};

function sanitizeShippingQuoteResponse(name, status, body, options = {}) {
  const sensitiveKeyPattern = /token|authorization|document|phone|email|address|street|number|complement|postal|cep/i;
  const result = {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    provider: TEST_PROVIDER || null,
    quote_sent: !!options.quote_sent,
    mutation_executed: false,
    body_type: body == null ? null : Array.isArray(body) ? 'array' : typeof body,
    item_count: Array.isArray(body) ? body.length : null,
    response_keys: body && typeof body === 'object' && !Array.isArray(body)
      ? Object.keys(body).filter((key) => !sensitiveKeyPattern.test(key)).slice(0, 10)
      : [],
    error: null,
  };

  const error = body && typeof body === 'object' ? body.error || body.message || body.raw || null : null;
  if (error) result.error = String(error).slice(0, 180);
  return result;
}

function output(result, ok = true) {
  console.log(JSON.stringify({ ok, mutation_executed: false, quote_sent: !!result.quote_sent, results: [result] }, null, 2));
}

function validateInput() {
  if (!TEST_PROVIDER) return 'missing_SHIPPING_TEST_PROVIDER';
  if (!['frenet', 'melhor-envio'].includes(TEST_PROVIDER)) return 'invalid_SHIPPING_TEST_PROVIDER';
  if (!TEST_FROM_CEP) return 'missing_SHIPPING_TEST_FROM_CEP';
  if (!TEST_TO_CEP) return 'missing_SHIPPING_TEST_TO_CEP';
  if (!TEST_TOKEN && !DRY_RUN) return 'missing_SHIPPING_TEST_TOKEN';
  return null;
}

async function postShippingQuote() {
  const response = await fetch(`${BASE_URL}/api/shipping?provider=${encodeURIComponent(TEST_PROVIDER)}&action=calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: TEST_TOKEN,
      from_cep: TEST_FROM_CEP,
      to_cep: TEST_TO_CEP,
      ...DEFAULT_PACKAGE,
      sandbox: process.env.SHIPPING_TEST_SANDBOX === 'true',
    }),
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parse_error: true, raw: text.slice(0, 180) };
  }
  return { status: response.status, body };
}

async function run() {
  const validationReason = validateInput();
  if (validationReason) {
    const result = sanitizeShippingQuoteResponse('shipping_quote_calculate', 0, null, {
      skipped: true,
      reason: validationReason,
      quote_sent: false,
    });
    output(result);
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeShippingQuoteResponse('shipping_quote_calculate', 0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      quote_sent: false,
    });
    output(result);
    return;
  }

  const { status, body } = await postShippingQuote();
  const result = sanitizeShippingQuoteResponse('shipping_quote_calculate', status, body, { quote_sent: true });
  const ok = result.ok_http && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, quote_sent: false, error: err.message }, null, 2));
  process.exit(1);
});
