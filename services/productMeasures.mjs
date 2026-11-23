// product-measures-single-source-v1
// Uma fonte só para peso e medidas do produto.
// As colunas products.weight_kg / products.dimensions são a fonte que todos leem,
// e as Especificações (specs.weight_kg, specs['dimensions.*']) são espelho dela.
// Na gravação vale o campo que a pessoa mexeu: se a seção de medidas (colunas)
// mudou e a especificação não, vale a coluna; senão vale a especificação.

export const MEASURE_KEYS = ['height_cm', 'width_cm', 'depth_cm'];

export function toMeasure(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDims(value) {
    if (!value) return {};
    if (typeof value === 'string') {
        try { return parseDims(JSON.parse(value)); } catch { return {}; }
    }
    return typeof value === 'object' ? value : {};
}

function specValue(specs, key) {
    if (!specs || typeof specs !== 'object') return null;
    if (key === 'weight_kg') return toMeasure(specs.weight_kg);
    const flat = toMeasure(specs[`dimensions.${key}`]);
    if (flat !== null) return flat;
    return toMeasure(parseDims(specs.dimensions)[key]);
}

function columnValue(weight, dims, key) {
    return key === 'weight_kg' ? toMeasure(weight) : toMeasure(parseDims(dims)[key]);
}

const same = (a, b) => (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);

/**
 * @param {object} p
 * @param {object} [p.inputSpecs]   specs enviadas pelo formulário
 * @param {*} [p.inputDimensions]   dimensions enviadas pelo formulário
 * @param {*} [p.inputWeight]       weight_kg enviado pelo formulário
 * @param {object} [p.old]          produto antes da gravação (update)
 * @param {object} [p.templateValues] template_values do modelo (só preenche o que faltar)
 * @returns {{ weight_kg: number|null, dimensions: object|null, specsPatch: object }}
 */
export function resolveProductMeasures({ inputSpecs, inputDimensions, inputWeight, old, templateValues } = {}) {
    const result = {};
    for (const key of ['weight_kg', ...MEASURE_KEYS]) {
        const spec = specValue(inputSpecs, key);
        const col = columnValue(inputWeight, inputDimensions, key);
        const oldSpec = old ? specValue(old.specs, key) : null;
        const oldCol = old ? columnValue(old.weight_kg, old.dimensions, key) : null;
        const tpl = specValue(templateValues, key);
        const colEdited = col !== null && !same(col, oldCol);
        const specEdited = spec !== null && !same(spec, oldSpec);
        let value;
        if (colEdited && !specEdited) value = col;
        else value = spec ?? col ?? (old ? (oldSpec ?? oldCol) : null) ?? tpl;
        result[key] = value ?? null;
    }
    const hasDims = MEASURE_KEYS.some((k) => result[k] !== null);
    const dimensions = hasDims ? {
        ...parseDims(inputDimensions),
        height_cm: result.height_cm, width_cm: result.width_cm, depth_cm: result.depth_cm,
    } : null;
    const specsPatch = {};
    if (result.weight_kg !== null) specsPatch.weight_kg = result.weight_kg;
    for (const k of MEASURE_KEYS) if (result[k] !== null) specsPatch[`dimensions.${k}`] = result[k];
    return { weight_kg: result.weight_kg, dimensions, specsPatch };
}
