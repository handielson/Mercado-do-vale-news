const BASE_URL = process.env.VPS_API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const KIND = process.env.SHOPEE_TEST_WRITE_KIND || '';
const PRODUCT_ID = process.env.SHOPEE_TEST_ADD_ITEM_PRODUCT_ID || '';
const MEDIA_DATA_URL = process.env.SHOPEE_TEST_MEDIA_DATA_URL || '';
const MEDIA_FILE_NAME = process.env.SHOPEE_TEST_MEDIA_FILE_NAME || '';
const CONFIRMATION = process.env.CONFIRM_SHOPEE_TEST_ADD_ITEM_MEDIA || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_SHOPEE_TEST_ADD_ITEM_MEDIA';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const WRITE_CONFIG = {
  add_item: {
    name: 'actions_add_item',
    path: '/api/shopee-actions?action=add_item',
    payload: () => ({
      product_id: PRODUCT_ID,
      category_id: optionalNumber(process.env.SHOPEE_TEST_ADD_ITEM_CATEGORY_ID),
      brand_id: optionalNumber(process.env.SHOPEE_TEST_ADD_ITEM_BRAND_ID),
      brand_name: process.env.SHOPEE_TEST_ADD_ITEM_BRAND_NAME || undefined,
      logistic_id: optionalNumber(process.env.SHOPEE_TEST_ADD_ITEM_LOGISTIC_ID),
    }),
  },
  upload_image: {
    name: 'catalog_upload_image',
    path: '/api/shopee-catalog?action=upload_image',
    payload: () => ({
      image_data_url: MEDIA_DATA_URL,
      file_name: MEDIA_FILE_NAME || undefined,
    }),
  },
  upload_video: {
    name: 'catalog_upload_video',
    path: '/api/shopee-catalog?action=upload_video',
    payload: () => ({
      video_data_url: MEDIA_DATA_URL,
      file_name: MEDIA_FILE_NAME || undefined,
    }),
  },
};

function optionalNumber(value) {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function sanitizePayload(payload) {
  const copy = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value !== undefined) copy[key] = value;
  }
  return copy;
}

function sanitizeShopeeAddItemMediaResponse(name, status, body, options = {}) {
  const response = body && typeof body === 'object' ? body.response || body.data || null : null;
  const error = body && typeof body === 'object' ? body.error || body.message || null : null;
  const warning = body && typeof body === 'object' ? body.warning || null : null;
  const sensitiveKeyPattern = /item_id|image_id|video|upload|product_id|sku|price|stock|url|file/i;

  return {
    name,
    status,
    ok_http: status >= 200 && status < 300,
    dry_run: !!options.dry_run,
    skipped: !!options.skipped,
    reason: options.reason || null,
    mutation_executed: !!options.mutation_executed,
    has_response: !!response,
    response_keys: response ? Object.keys(response).filter((key) => !sensitiveKeyPattern.test(key)).slice(0, 8) : [],
    error: error ? String(error).slice(0, 160) : null,
    warning: warning ? String(warning).slice(0, 160) : null,
  };
}

function output(result, ok = true) {
  console.log(JSON.stringify({ ok, mutation_executed: !!result.mutation_executed, results: [result] }, null, 2));
}

function validateInput(config) {
  if (!KIND) return 'missing_SHOPEE_TEST_WRITE_KIND';
  if (!config) return 'invalid_SHOPEE_TEST_WRITE_KIND';
  if (KIND === 'add_item' && !PRODUCT_ID) return 'missing_SHOPEE_TEST_ADD_ITEM_PRODUCT_ID';
  if (KIND === 'upload_image' && !MEDIA_DATA_URL.startsWith('data:image/')) return 'missing_or_invalid_SHOPEE_TEST_MEDIA_DATA_URL';
  if (KIND === 'upload_video' && !MEDIA_DATA_URL.startsWith('data:video/')) return 'missing_or_invalid_SHOPEE_TEST_MEDIA_DATA_URL';
  return null;
}

async function postShopeeWrite(config) {
  const response = await fetch(`${BASE_URL}${config.path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sanitizePayload(config.payload())),
    signal: AbortSignal.timeout(120000),
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
  const config = WRITE_CONFIG[KIND];
  const validationReason = validateInput(config);
  const name = config?.name || `shopee_${KIND || 'write'}`;

  if (validationReason) {
    output(sanitizeShopeeAddItemMediaResponse(name, 0, null, {
      skipped: true,
      reason: validationReason,
      mutation_executed: false,
    }));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    output(sanitizeShopeeAddItemMediaResponse(name, 0, null, {
      dry_run: true,
      skipped: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      mutation_executed: false,
    }));
    return;
  }

  const { status, body } = await postShopeeWrite(config);
  const result = sanitizeShopeeAddItemMediaResponse(name, status, body, { mutation_executed: true });
  const ok = result.ok_http && !result.error;
  output(result, ok);
  if (!ok) process.exit(1);
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, mutation_executed: false, error: err.message }, null, 2));
  process.exit(1);
});
