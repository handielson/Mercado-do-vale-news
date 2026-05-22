const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const TEST_BLING_ID = process.env.BLING_TEST_STOCK_SYNC_BLING_ID || '';
const TEST_QUANTITY = Number(process.env.BLING_TEST_STOCK_SYNC_QUANTITY || 0);
const TEST_NOTES = process.env.BLING_TEST_STOCK_SYNC_NOTES || 'Teste controlado migração VPS';
const CONFIRMATION = process.env.CONFIRM_BLING_STOCK_SYNC || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_BLING_STOCK_SYNC';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function sanitizeBlingStockSyncResponse(status, body, options = {}) {
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const debug = body && typeof body === 'object' && body.debug ? body.debug : null;

  return {
    name: 'bling_stock_sync',
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    mutation_executed: !!options.mutation_executed,
    has_ok_flag: !!(body && typeof body === 'object' && body.ok),
    error: error ? String(error).slice(0, 160) : null,
    debug_scope: debug && typeof debug === 'object' ? debug.scope || null : null,
    debug_step: debug && typeof debug === 'object' ? debug.step || null : null,
  };
}

function output(result, ok = true) {
  console.log(JSON.stringify({ ok, mutation_executed: !!result.mutation_executed, results: [result] }, null, 2));
}

function validateInput() {
  if (!TEST_BLING_ID) return 'missing_BLING_TEST_STOCK_SYNC_BLING_ID';
  if (!Number.isFinite(TEST_QUANTITY) || TEST_QUANTITY <= 0) return 'invalid_BLING_TEST_STOCK_SYNC_QUANTITY';
  if (TEST_QUANTITY > 5) return 'quantity_above_guard_limit';
  return null;
}

async function postBlingStockSync() {
  const response = await fetch(`${BASE_URL}/api/bling?resource=stock-sync`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blingId: TEST_BLING_ID,
      quantity: TEST_QUANTITY,
      notes: TEST_NOTES,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parse_error: true, error: text.slice(0, 160) };
  }
  return { status: response.status, body };
}

async function run() {
  const validationReason = validateInput();
  if (validationReason) {
    output(sanitizeBlingStockSyncResponse(0, null, {
      skipped: true,
      reason: validationReason,
      mutation_executed: false,
    }));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    output(sanitizeBlingStockSyncResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      mutation_executed: false,
    }));
    return;
  }

  const { status, body } = await postBlingStockSync();
  const result = sanitizeBlingStockSyncResponse(status, body, { mutation_executed: true });
  const ok = result.ok_http && result.has_ok_flag && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, error: err.message }, null, 2));
  process.exit(1);
});
