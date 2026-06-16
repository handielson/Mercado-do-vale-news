const UNIQUE_SERIALIZED_SPEC_KEYS = ['imei1', 'imei2', 'serial'];
const ARRAY_FIELDS = ['eans', 'images', 'keywords', 'kits', 'tags'];
const BOOLEAN_FIELDS = ['track_inventory', 'is_gift', 'is_combo', 'is_virtual', 'exclude_from_seo'];

function parseJsonValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!/^[\[{]/.test(trimmed)) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toArray(value) {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) return parsed.filter((item) => item != null && item !== '');
  if (parsed == null || parsed === '') return [];
  if (typeof parsed === 'string') {
    return parsed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toObject(value) {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function uniqueArray(values) {
  return Array.from(new Set(values.filter((item) => item != null && item !== '').map(String)));
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}

export function normalizeProductFormBooleans(product = {}) {
  const normalized = { ...product };
  BOOLEAN_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = toBoolean(normalized[field]);
    }
  });
  return normalized;
}

export function buildProductClonePrefill(product = {}) {
  const clone = {
    ...normalizeProductFormBooleans(product),
    specs: toObject(product.specs),
  };

  delete clone.id;
  delete clone.created_at;
  delete clone.updated_at;

  UNIQUE_SERIALIZED_SPEC_KEYS.forEach((key) => {
    clone.specs[key] = '';
  });

  ARRAY_FIELDS.forEach((field) => {
    clone[field] = toArray(clone[field]);
  });

  clone.eans = [];

  clone.images = uniqueArray([
    ...toArray(product.images),
    ...toArray(product.product_images),
    ...toArray(product.image_url),
    ...toArray(product.image),
  ]);

  return clone;
}

export function getProductCloneState(product = {}) {
  return {
    cloneProduct: buildProductClonePrefill(product),
  };
}
