const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const ACTION = process.env.BLING_FINANCE_TEST_ACTION || '';
const RESOURCE_TYPE = process.env.BLING_FINANCE_TEST_RESOURCE_TYPE || '';
const FINANCE_ID = process.env.BLING_FINANCE_TEST_ID || '';
const AUTHORIZATION = process.env.BLING_FINANCE_TEST_AUTHORIZATION || '';
const BODY_JSON = process.env.BLING_FINANCE_TEST_BODY_JSON || '';
const CONFIRMATION = process.env.CONFIRM_BLING_FINANCE_MUTATION || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_BLING_FINANCE_MUTATION';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const ACTION_METHODS = {
  create: 'POST',
  update: 'PUT',
  baixar: 'POST',
  cancelar: 'DELETE',
};

function parseBodyJson() {
  if (!BODY_JSON) return {};
  try {
    const body = JSON.parse(BODY_JSON);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'body_must_be_json_object' };
    }
    return { body };
  } catch {
    return { error: 'invalid_BLING_FINANCE_TEST_BODY_JSON' };
  }
}

function sanitizeFinanceMutationResponse(status, body, options = {}) {
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const debug = body && typeof body === 'object' && body.debug ? body.debug : null;

  return {
    name: `bling_finance_${ACTION || 'mutation'}`,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    mutation_executed: !!options.mutation_executed,
    has_success_flag: !!(body && typeof body === 'object' && body.success),
    has_data: !!(body && typeof body === 'object' && body.data),
    error: error ? String(error).slice(0, 160) : null,
    debug_scope: debug && typeof debug === 'object' ? debug.scope || null : null,
    debug_step: debug && typeof debug === 'object' ? debug.step || null : null,
  };
}

function output(result, ok = true) {
  console.log(JSON.stringify({ ok, mutation_executed: !!result.mutation_executed, results: [result] }, null, 2));
}

function validateInput(parsedBody) {
  if (!ACTION) return 'missing_BLING_FINANCE_TEST_ACTION';
  if (!Object.hasOwn(ACTION_METHODS, ACTION)) return 'invalid_BLING_FINANCE_TEST_ACTION';
  if (!['pagar', 'receber'].includes(RESOURCE_TYPE)) return 'invalid_BLING_FINANCE_TEST_RESOURCE_TYPE';
  if (['update', 'baixar', 'cancelar'].includes(ACTION) && !FINANCE_ID) return 'missing_BLING_FINANCE_TEST_ID';
  if (['create', 'update', 'baixar'].includes(ACTION) && !BODY_JSON) return 'missing_BLING_FINANCE_TEST_BODY_JSON';
  if (parsedBody.error) return parsedBody.error;
  if (!AUTHORIZATION) return 'missing_BLING_FINANCE_TEST_AUTHORIZATION';
  return null;
}

function buildFinanceUrl() {
  const params = new URLSearchParams({
    resourceType: RESOURCE_TYPE,
    action: ACTION,
  });
  if (FINANCE_ID) params.set('id', FINANCE_ID);
  return `${BASE_URL}/api/bling?resource=finance&${params.toString()}`;
}

async function sendFinanceMutation(body) {
  const method = ACTION_METHODS[ACTION];
  const headers = {
    Accept: 'application/json',
    Authorization: AUTHORIZATION,
  };
  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(30000),
  };
  if (method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body || {});
  }

  const response = await fetch(buildFinanceUrl(), options);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { parse_error: true, error: text.slice(0, 160) };
  }
  return { status: response.status, body: parsed };
}

async function run() {
  const parsedBody = parseBodyJson();
  const validationReason = validateInput(parsedBody);
  if (validationReason) {
    output(sanitizeFinanceMutationResponse(0, null, {
      skipped: true,
      reason: validationReason,
      mutation_executed: false,
    }));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    output(sanitizeFinanceMutationResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      mutation_executed: false,
    }));
    return;
  }

  const { status, body } = await sendFinanceMutation(parsedBody.body);
  const result = sanitizeFinanceMutationResponse(status, body, { mutation_executed: true });
  const ok = result.ok_http && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, error: err.message }, null, 2));
  process.exit(1);
});
