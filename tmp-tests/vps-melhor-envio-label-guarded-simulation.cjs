const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_TOKEN = process.env.MELHOR_ENVIO_TEST_TOKEN || '';
const TEST_CARRIER_ID = process.env.MELHOR_ENVIO_TEST_CARRIER_ID || '';
const TEST_FROM_CEP = process.env.MELHOR_ENVIO_TEST_FROM_CEP || '';
const CONFIRMATION = process.env.CONFIRM_MELHOR_ENVIO_LABEL_SIMULATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_MELHOR_ENVIO_LABEL_SIMULATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const TEST_TO = {
  name: process.env.MELHOR_ENVIO_TEST_TO_NAME || '',
  phone: process.env.MELHOR_ENVIO_TEST_TO_PHONE || '',
  document: process.env.MELHOR_ENVIO_TEST_TO_DOCUMENT || '',
  address: process.env.MELHOR_ENVIO_TEST_TO_ADDRESS || '',
  city: process.env.MELHOR_ENVIO_TEST_TO_CITY || '',
  district: process.env.MELHOR_ENVIO_TEST_TO_DISTRICT || '',
  state_abbr: process.env.MELHOR_ENVIO_TEST_TO_STATE || '',
  postal_code: process.env.MELHOR_ENVIO_TEST_TO_POSTAL_CODE || '',
  number: process.env.MELHOR_ENVIO_TEST_TO_NUMBER || '',
  complement: process.env.MELHOR_ENVIO_TEST_TO_COMPLEMENT || '',
};

const TEST_PRODUCTS = [
  {
    name: process.env.MELHOR_ENVIO_TEST_PRODUCT_NAME || 'Produto teste Mercado do Vale',
    quantity: Number(process.env.MELHOR_ENVIO_TEST_PRODUCT_QUANTITY || 1),
    weight: Number(process.env.MELHOR_ENVIO_TEST_PRODUCT_WEIGHT_KG || 0.3),
  },
];

function sanitizeMelhorEnvioLabelResponse(name, status, body, options = {}) {
  const responseKeys = body && typeof body === 'object' && !Array.isArray(body)
    ? Object.keys(body).filter((key) => !/token|authorization|document|phone|email|address|street|number|complement|postal|cep|url/i.test(key)).slice(0, 10)
    : [];
  const error = body && typeof body === 'object' ? body.error || body.message || body.raw || null : null;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    label_requested: !!options.label_requested,
    mutation_executed: !!options.label_requested,
    has_print_url: !!(body && typeof body === 'object' && body.url),
    has_order_id: !!(body && typeof body === 'object' && body.order_id),
    response_keys: responseKeys,
    error: error ? String(error).slice(0, 180) : null,
  };
}

function output(result, ok = true) {
  console.log(JSON.stringify({
    ok,
    mutation_executed: !!result.mutation_executed,
    label_requested: !!result.label_requested,
    results: [result],
  }, null, 2));
}

function validateInput() {
  if (!TEST_TOKEN && !DRY_RUN) return 'missing_MELHOR_ENVIO_TEST_TOKEN';
  if (!TEST_CARRIER_ID) return 'missing_MELHOR_ENVIO_TEST_CARRIER_ID';
  if (!TEST_FROM_CEP) return 'missing_MELHOR_ENVIO_TEST_FROM_CEP';
  if (!TEST_TO.name) return 'missing_MELHOR_ENVIO_TEST_TO_NAME';
  if (!TEST_TO.document) return 'missing_MELHOR_ENVIO_TEST_TO_DOCUMENT';
  if (!TEST_TO.address) return 'missing_MELHOR_ENVIO_TEST_TO_ADDRESS';
  if (!TEST_TO.city) return 'missing_MELHOR_ENVIO_TEST_TO_CITY';
  if (!TEST_TO.district) return 'missing_MELHOR_ENVIO_TEST_TO_DISTRICT';
  if (!TEST_TO.state_abbr) return 'missing_MELHOR_ENVIO_TEST_TO_STATE';
  if (!TEST_TO.postal_code) return 'missing_MELHOR_ENVIO_TEST_TO_POSTAL_CODE';
  if (!TEST_TO.number) return 'missing_MELHOR_ENVIO_TEST_TO_NUMBER';
  return null;
}

async function postMelhorEnvioLabel() {
  const response = await fetch(`${BASE_URL}/api/shipping?provider=melhor-envio&action=label`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: TEST_TOKEN,
      carrier_id: TEST_CARRIER_ID,
      from_cep: TEST_FROM_CEP,
      to: TEST_TO,
      products: TEST_PRODUCTS,
      sandbox: process.env.MELHOR_ENVIO_TEST_SANDBOX === 'true',
    }),
    signal: AbortSignal.timeout(30000),
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
    const result = sanitizeMelhorEnvioLabelResponse('melhor_envio_label', 0, null, {
      skipped: true,
      reason: validationReason,
      label_requested: false,
    });
    output(result);
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    const result = sanitizeMelhorEnvioLabelResponse('melhor_envio_label', 0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      label_requested: false,
    });
    output(result);
    return;
  }

  const { status, body } = await postMelhorEnvioLabel();
  const result = sanitizeMelhorEnvioLabelResponse('melhor_envio_label', status, body, { label_requested: true });
  const ok = result.ok_http && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, label_requested: false, error: err.message }, null, 2));
  process.exit(1);
});
