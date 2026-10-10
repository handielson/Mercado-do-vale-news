// UI/announcements use mm; the existing API/freight contract remains cm/kg.
// Conversion never creates a second measurement record.
export const PRINT3D_MEASUREMENT_FIELDS = [
  { key: 'dimensions.height_cm', label: 'Altura', unit: 'mm', max: 1050, factor: 10 },
  { key: 'dimensions.width_cm', label: 'Largura', unit: 'mm', max: 1050, factor: 10 },
  { key: 'dimensions.depth_cm', label: 'Profundidade', unit: 'mm', max: 1050, factor: 10 },
  { key: 'weight_kg', label: 'Peso', unit: 'kg', max: 30, factor: 1 },
];

export function print3dMeasurementDisplayValue(key, value) {
  if (value == null || value === '') return '';
  const factor = PRINT3D_MEASUREMENT_FIELDS.find(field => field.key === key)?.factor || 1;
  return Number((Number(value) * factor).toPrecision(12));
}

export function print3dMeasurementStoredValue(key, value) {
  if (value == null || String(value).trim() === '') return null;
  const factor = PRINT3D_MEASUREMENT_FIELDS.find(field => field.key === key)?.factor || 1;
  return Number((Number(String(value).replace(',', '.')) / factor).toPrecision(12));
}

export function parsePieceMeasurement(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function formatPrint3dMeasurements(product = {}) {
  let dimensions = product.dimensions || {};
  if (typeof dimensions === 'string') {
    try { dimensions = JSON.parse(dimensions) || {}; } catch { dimensions = {}; }
  }
  return PRINT3D_MEASUREMENT_FIELDS.flatMap(field => {
    const value = parsePieceMeasurement(field.key === 'weight_kg' ? product.weight_kg : dimensions[field.key.split('.')[1]]);
    return value == null ? [] : [`${field.label}: ${print3dMeasurementDisplayValue(field.key, value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${field.unit}`];
  }).join(' • ');
}

// Derived for display only; never replace the parent's description or persist a second copy.
export function print3dPublicMeasurementSpecs(product = {}) {
  const specs = product.specs || {};
  const result = { ...specs };
  const summary = formatPrint3dMeasurements(product);
  if (summary) {
    delete result.size;
    delete result.tamanho;
    for (const key of ['weight_kg', 'width_cm', 'height_cm', 'depth_cm', ...PRINT3D_MEASUREMENT_FIELDS.map(field => field.key)]) delete result[key];
    result.piece_measurements = summary;
  }
  return result;
}
