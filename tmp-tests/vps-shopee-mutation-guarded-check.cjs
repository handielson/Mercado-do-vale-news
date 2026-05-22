const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_PRODUCT_ID = process.env.SHOPEE_TEST_PRODUCT_ID || '';
const CONFIRMATION = process.env.CONFIRM_SHOPEE_TEST_MUTATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHOPEE_TEST_MUTATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const mutationChecks = [
  {
    name: 'actions_update_stock',
    path: '/api/shopee-actions?action=update_stock',
    payload: { product_id: TEST_PRODUCT_ID, stock: Number(process.env.SHOPEE_TEST_STOCK || 1) },
  },
  {
    name: 'actions_update_price',
    path: '/api/shopee-actions?action=update_price',
    payload: { product_id: TEST_PRODUCT_ID, price: Number(process.env.SHOPEE_TEST_PRICE_CENTS || 100) },
  },
];

function sanitizeShopeeMutationResponse(name, status, body, options = {}) {
  const response = body && typeof body === 'object' ? body.response : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /item_id|model_id|sku|price|stock|product_id/i;

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

async function postShopeeMutation(path, payload) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

  if (!TEST_PRODUCT_ID) {
    for (const check of mutationChecks) {
      results.push(sanitizeShopeeMutationResponse(check.name, 0, null, {
        skipped: true,
        reason: 'missing_SHOPEE_TEST_PRODUCT_ID',
      }));
    }
    console.log(JSON.stringify({ ok: true, mutation_executed: false, results }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    for (const check of mutationChecks) {
      results.push(sanitizeShopeeMutationResponse(check.name, 0, null, {
        dry_run: true,
        skipped: true,
        reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      }));
    }
    console.log(JSON.stringify({ ok: true, mutation_executed: false, results }, null, 2));
    return;
  }

  for (const check of mutationChecks) {
    const { status, body } = await postShopeeMutation(check.path, check.payload);
    results.push(sanitizeShopeeMutationResponse(check.name, status, body));
  }

  const ok = results.every((result) => result.ok_http && !result.error);
  console.log(JSON.stringify({ ok, mutation_executed: true, results }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
