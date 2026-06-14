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
            return { color: color.name };
        }
    }

    return {};
}
