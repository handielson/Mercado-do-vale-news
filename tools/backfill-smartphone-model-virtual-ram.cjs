const path = require('node:path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {}

const APPLY = process.argv.includes('--apply');
const FIELD_KEY = 'memoria_ram_virtual';
const DEFAULT_VALUE = '';
const CATEGORY_NAMES = new Set(['smartphones', 'celulares']);

const VPS_BASE = (process.env.VITE_VPS_BASE_URL || process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_KEY = process.env.SYNC_SECRET || process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';

if (!SYNC_KEY) {
  console.error('Missing VPS sync key. Expected SYNC_SECRET, VPS_SYNC_KEY or VITE_VPS_SYNC_KEY.');
  process.exit(1);
}

async function getFetch() {
  if (typeof fetch === 'function') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function vpsFetch(pathname, options = {}) {
  const requestFetch = await getFetch();
  const res = await requestFetch(`${VPS_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-sync-key': SYNC_KEY,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status} ${json?.error || text || ''}`.trim());
  return json;
}

async function selectAllTable(table) {
  const pageSize = 200;
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const data = await vpsFetch(`/table-data/${table}?limit=${pageSize}&offset=${offset}`);
    const pageRows = Array.isArray(data?.rows) ? data.rows : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return rows;
}

async function patchModelTemplateValues(modelId, nextTemplateValues) {
  return vpsFetch(`/table-data/models/${encodeURIComponent(modelId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ template_values: nextTemplateValues }),
  });
}

async function main() {
  const categories = await vpsFetch('/table-data/categories?limit=200&offset=0')
    .then((data) => (Array.isArray(data?.rows) ? data.rows : []));
  const smartphoneCategories = categories.filter((category) => CATEGORY_NAMES.has(String(category.name || '').trim().toLowerCase()));
  const smartphoneCategoryIds = new Set(smartphoneCategories.map((category) => String(category.id)));

  if (smartphoneCategoryIds.size === 0) {
    throw new Error('No Smartphone/Celular categories found.');
  }

  const models = (await selectAllTable('models'))
    .filter((model) => smartphoneCategoryIds.has(String(model.category_id)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const missingField = models.filter((model) => {
    const templateValues = parseJsonObject(model.template_values);
    return !Object.prototype.hasOwnProperty.call(templateValues, FIELD_KEY);
  });

  const alreadyPresent = models.length - missingField.length;
  const updated = [];
  const failed = [];

  if (APPLY) {
    for (const model of missingField) {
      const templateValues = parseJsonObject(model.template_values);
      const nextTemplateValues = {
        ...templateValues,
        [FIELD_KEY]: DEFAULT_VALUE,
      };

      try {
        await patchModelTemplateValues(model.id, nextTemplateValues);
        updated.push({ id: model.id, name: model.name });
      } catch (error) {
        failed.push({ id: model.id, name: model.name, error: error.message });
      }
    }
  }

  const result = {
    ok: failed.length === 0,
    mode: APPLY ? 'apply' : 'dry-run',
    field: FIELD_KEY,
    defaultValue: DEFAULT_VALUE,
    categories: smartphoneCategories.map((category) => ({ id: category.id, name: category.name })),
    totalModels: models.length,
    alreadyPresent,
    missing: missingField.length,
    updated: updated.length,
    failed,
    sampleMissing: missingField.slice(0, 20).map((model) => ({ id: model.id, name: model.name })),
  };

  console.log(JSON.stringify(result, null, 2));

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
