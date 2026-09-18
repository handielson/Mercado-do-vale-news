function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatSharedColor(value) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    if (!normalized) return '';

    const lowerCase = normalized.toLocaleLowerCase('pt-BR');
    return lowerCase.replace(/^./u, character => character.toLocaleUpperCase('pt-BR'));
}

export function normalizeSharedColors(values) {
    const colors = [];
    const seen = new Set();

    for (const value of values || []) {
        const color = formatSharedColor(value);
        const key = color.toLocaleLowerCase('pt-BR');
        if (!color || seen.has(key)) continue;
        seen.add(key);
        colors.push(color);
    }

    return colors;
}

export function stripSharedProductColorVariation(value, colorValue = '') {
    const originalName = String(value || '').trim().replace(/\s+/g, ' ');
    if (!originalName) return 'Produto';

    const withoutLabelledColor = originalName
        .replace(/\s*(?:[-–—,|]\s*)?(?:cor|color|colour)\s*:\s*.+$/iu, '')
        .trim();

    if (withoutLabelledColor !== originalName) {
        return withoutLabelledColor || originalName;
    }

    const color = String(colorValue || '').trim().replace(/\s+/g, ' ');
    if (!color) return originalName;

    const withoutColorSuffix = originalName
        .replace(new RegExp(`(?:\\s*[-–—,|]\\s*|\\s+)${escapeRegExp(color)}\\s*$`, 'iu'), '')
        .trim();

    return withoutColorSuffix || originalName;
}

export function buildSharedColorLines(values, indent = '   ') {
    const colors = normalizeSharedColors(values);
    if (colors.length === 0) return ['', `${indent}🎨 Cores: Consultar`];

    return [
        '',
        `${indent}🎨 Cores:`,
        ...colors.map((color, index) => `${indent}${index + 1}. ${color}`),
        '',
    ];
}
