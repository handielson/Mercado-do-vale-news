function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getVariationColorText(variationName) {
    const parts = String(variationName || '')
        .split(/[;|,/]+/)
        .map(part => part.trim())
        .filter(Boolean);

    const colorPart = parts.find(part => normalizeText(part).startsWith('cor '));
    if (!colorPart) return '';

    return colorPart
        .replace(/^cor\s*[:=-]?\s*/i, '')
        .trim();
}

function normalizeCapacity(value) {
    const match = String(value || '').match(/(\d+(?:[.,]\d+)?)\s*(tb|gb)\b/i);
    if (!match) return '';

    const numberText = match[1].replace(',', '.');
    const numberValue = Number(numberText);
    const normalizedNumber = Number.isFinite(numberValue)
        ? String(numberValue).replace(/\.0$/, '')
        : match[1];
    const unit = match[2].toLowerCase().startsWith('t') ? 'TB' : 'GB';

    return `${normalizedNumber}${unit}`;
}

function getLabeledCapacityText(text, labels) {
    const parts = String(text || '')
        .split(/[;|,/]+/)
        .map(part => part.trim())
        .filter(Boolean);

    for (const part of parts) {
        const normalizedPart = normalizeText(part);
        if (!labels.some(label => normalizedPart.startsWith(label))) continue;
        const capacity = normalizeCapacity(part);
        if (capacity) return capacity;
    }

    return '';
}

function getUnlabeledCapacities(text) {
    const matches = String(text || '').match(/\d+(?:[.,]\d+)?\s*(?:tb|gb)\b/gi) || [];
    const capacities = matches
        .map(normalizeCapacity)
        .filter(Boolean);

    return [...new Set(capacities)];
}

function capacityRank(capacity) {
    const match = String(capacity || '').match(/^(\d+(?:\.\d+)?)(TB|GB)$/i);
    if (!match) return 0;
    const value = Number(match[1]);
    return match[2].toUpperCase() === 'TB' ? value * 1024 : value;
}

function getSpecCapacityAutofill(product) {
    const variationName = product?.variacao?.nome || '';
    const labeledRam = getLabeledCapacityText(variationName, ['memoria ram', 'memoria', 'ram']);
    const labeledStorage = getLabeledCapacityText(variationName, ['armazenamento', 'storage', 'capacidade']);

    const result = {};
    if (labeledRam) result.ram = labeledRam;
    if (labeledStorage) result.storage = labeledStorage;
    if (result.ram || result.storage) return result;

    for (const candidate of [product?.nome, product?.nomePai, variationName]) {
        const capacities = getUnlabeledCapacities(candidate);
        if (capacities.length >= 2) {
            const sorted = [...capacities].sort((a, b) => capacityRank(b) - capacityRank(a));
            return {
                storage: sorted[0],
                ram: sorted[sorted.length - 1],
            };
        }
    }

    return {};
}

function findColorInText(text, colors) {
    const normalizedText = normalizeText(text);
    if (!normalizedText) return null;

    const sortedColors = [...(colors || [])]
        .filter(color => color?.name)
        .sort((a, b) => String(b.name).length - String(a.name).length);

    return sortedColors.find(color => {
        const normalizedColor = normalizeText(color.name);
        if (!normalizedColor) return false;
        const pattern = new RegExp(`(^|\\s)${normalizedColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
        return pattern.test(normalizedText);
    }) || null;
}

export function getBlingSkuSpecAutofill({ product, colors }) {
    if (!product) return {};

    const capacityAutofill = getSpecCapacityAutofill(product);
    const variationColorText = getVariationColorText(product.variacao?.nome);
    const candidates = [
        variationColorText,
        product.variacao?.nome,
        product.nome,
        product.nomePai,
    ];

    for (const candidate of candidates) {
        const color = findColorInText(candidate, colors);
        if (color?.name) {
            return { color: color.name, ...capacityAutofill };
        }
    }

    return capacityAutofill;
}
