const UNIQUE_SERIALIZED_SPEC_KEYS = ['imei1', 'imei2', 'serial'];
const ARRAY_FIELDS = ['eans', 'images', 'keywords', 'kits', 'tags'];

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

export function buildProductClonePrefill(product = {}) {
  const clone = {
    ...product,
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

  clone.eans = uniqueArray([
    ...toArray(product.eans),
    ...toArray(product.alternative_eans),
    ...toArray(product.ean),
  ]);

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
