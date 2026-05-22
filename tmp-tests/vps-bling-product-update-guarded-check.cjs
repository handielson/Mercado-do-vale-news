const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const KIND = process.env.BLING_PRODUCT_UPDATE_KIND || 'fiscal';
const CONFIRMATION = process.env.CONFIRM_BLING_PRODUCT_UPDATE || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_BLING_PRODUCT_UPDATE';
const DRY_RUN = process.env.DRY_RUN !== 'false';

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function sanitizeProductUpdateResponse(status, body, options = {}) {
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const debug = body && typeof body === 'object' && body.debug ? body.debug : null;
  const results = Array.isArray(body?.results) ? body.results : null;

  return {
    name: `bling_product_update_${KIND}`,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    mutation_executed: !!options.mutation_executed,
    has_ok_flag: !!(body && typeof body === 'object' && body.ok),
    results_count: results ? results.length : null,
    successful_results: results ? results.filter((item) => item && item.success === true).length : null,
    error: error ? String(error).slice(0, 160) : null,
    debug_scope: debug && typeof debug === 'object' ? debug.scope || null : null,
    debug_step: debug && typeof debug === 'object' ? debug.step || null : null,
  };
}

function output(result, ok = true) {
  console.log(JSON.stringify({ ok, mutation_executed: !!result.mutation_executed, results: [result] }, null, 2));
}

function buildFiscalPayload() {
  const blingId = process.env.BLING_TEST_PRODUCT_UPDATE_BLING_ID || '';
  const origem = parseOptionalNumber(process.env.BLING_TEST_PRODUCT_UPDATE_ORIGEM);
  const payload = {
    blingId,
    ncm: process.env.BLING_TEST_PRODUCT_UPDATE_NCM || undefined,
    cest: process.env.BLING_TEST_PRODUCT_UPDATE_CEST || undefined,
    origem,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

function buildDimensionsPayload() {
  const ids = parseList(process.env.BLING_TEST_PRODUCT_UPDATE_BLING_IDS);
  const pesoBruto = parseOptionalNumber(process.env.BLING_TEST_PRODUCT_UPDATE_PESO_BRUTO);
  const largura = parseOptionalNumber(process.env.BLING_TEST_PRODUCT_UPDATE_LARGURA);
  const altura = parseOptionalNumber(process.env.BLING_TEST_PRODUCT_UPDATE_ALTURA);
  const profundidade = parseOptionalNumber(process.env.BLING_TEST_PRODUCT_UPDATE_PROFUNDIDADE);
  const dimensoes = {};
  if (largura !== undefined) dimensoes.largura = largura;
  if (altura !== undefined) dimensoes.altura = altura;
  if (profundidade !== undefined) dimensoes.profundidade = profundidade;

  const updateData = {};
  if (pesoBruto !== undefined) updateData.pesoBruto = pesoBruto;
  if (Object.keys(dimensoes).length) updateData.dimensoes = dimensoes;

  return { blingIds: ids, updateData };
}

function validateFiscal(payload) {
  if (!payload.blingId) return 'missing_BLING_TEST_PRODUCT_UPDATE_BLING_ID';
  if (!payload.ncm && !payload.cest && payload.origem === undefined) return 'missing_fiscal_update_fields';
  if (payload.ncm && !/^\d{8}$/.test(String(payload.ncm))) return 'invalid_ncm';
  if (payload.cest && !/^\d{7}$/.test(String(payload.cest))) return 'invalid_cest';
  if (payload.origem !== undefined && (!Number.isInteger(payload.origem) || payload.origem < 0 || payload.origem > 8)) return 'invalid_origem';
  return null;
}

function validateDimensions(payload) {
  if (!payload.blingIds.length) return 'missing_BLING_TEST_PRODUCT_UPDATE_BLING_IDS';
  if (payload.blingIds.length > 3) return 'too_many_bling_ids';
  const updateData = payload.updateData || {};
  const dimensoes = updateData.dimensoes || {};
  if (updateData.pesoBruto === undefined && !Object.keys(dimensoes).length) return 'missing_dimension_update_fields';
  if (updateData.pesoBruto !== undefined && (!Number.isFinite(updateData.pesoBruto) || updateData.pesoBruto <= 0 || updateData.pesoBruto > 10)) return 'invalid_peso_bruto';
  for (const [key, value] of Object.entries(dimensoes)) {
    if (!Number.isFinite(value) || value <= 0 || value > 200) return `invalid_${key}`;
  }
  return null;
}

function buildRequest() {
  if (KIND === 'fiscal') {
    const payload = buildFiscalPayload();
    return {
      resource: 'product-update-fiscal',
      payload,
      validationReason: validateFiscal(payload),
    };
  }

  if (KIND === 'dimensions') {
    const payload = buildDimensionsPayload();
    return {
      resource: 'product-update-dimensions',
      payload,
      validationReason: validateDimensions(payload),
    };
  }

  return {
    resource: null,
    payload: null,
    validationReason: 'invalid_BLING_PRODUCT_UPDATE_KIND',
  };
}

async function postProductUpdate(resource, payload) {
  const response = await fetch(`${BASE_URL}/api/bling?resource=${resource}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
  const request = buildRequest();
  if (request.validationReason) {
    output(sanitizeProductUpdateResponse(0, null, {
      skipped: true,
      reason: request.validationReason,
      mutation_executed: false,
    }));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    output(sanitizeProductUpdateResponse(0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      mutation_executed: false,
    }));
    return;
  }

  const { status, body } = await postProductUpdate(request.resource, request.payload);
  const result = sanitizeProductUpdateResponse(status, body, { mutation_executed: true });
  const ok = result.ok_http && (result.has_ok_flag || (KIND === 'dimensions' && result.results_count !== null)) && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, error: err.message }, null, 2));
  process.exit(1);
});
