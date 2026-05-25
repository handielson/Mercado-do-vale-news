const SERIALIZED_FIELDS = [
  { key: 'imei1', label: 'IMEI 1' },
  { key: 'imei2', label: 'IMEI 2' },
  { key: 'serial', label: 'Serial' },
];

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function hasSerializedIdentity(specs = {}) {
  return SERIALIZED_FIELDS.some(({ key }) => Boolean(cleanValue(specs?.[key])));
}

export function findSerializedBatchDuplicates(items) {
  const seen = new Map();
  const duplicates = [];

  for (const item of items) {
    for (const { key, label } of SERIALIZED_FIELDS) {
      const value = cleanValue(item?.[key]);
      if (!value) continue;

      const token = `${key}:${String(value).toLowerCase()}`;
      if (seen.has(token) && !duplicates.includes(`${label}: ${value}`)) {
        duplicates.push(`${label}: ${value}`);
      }
      seen.set(token, true);
    }
  }

  return duplicates;
}

export function buildSerializedBatchPlan(baseData, items) {
  const normalizedItems = items.map((item) => ({
    ...baseData,
    sku: cleanValue(item.sku) || baseData.sku,
    eans: Array.isArray(item.eans) && item.eans.length > 0 ? item.eans : baseData.eans,
    bling_id: item.bling_id ?? baseData.bling_id,
    bling_parent_id: item.bling_parent_id ?? baseData.bling_parent_id,
    stock_quantity: 1,
    specs: {
      ...(baseData.specs || {}),
      imei1: cleanValue(item.imei1) || undefined,
      imei2: cleanValue(item.imei2) || undefined,
      serial: cleanValue(item.serial) || undefined,
      color: cleanValue(item.color) || undefined,
      storage: cleanValue(item.storage) || undefined,
      ram: cleanValue(item.ram) || undefined,
      version: cleanValue(item.version) || undefined,
      battery_health: cleanValue(item.battery_health) || undefined,
    },
  }));

  return {
    batchStockQuantity: normalizedItems.length,
    items: normalizedItems,
  };
}

export function resolveSerializedBatchItemImages({ itemImages, colorImages, fallbackImages }) {
  if (Array.isArray(itemImages) && itemImages.length > 0) return itemImages;
  if (Array.isArray(colorImages) && colorImages.length > 0) return colorImages;
  return Array.isArray(fallbackImages) ? fallbackImages : [];
}
