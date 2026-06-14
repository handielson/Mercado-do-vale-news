/**
 * Money values inside Mercado do Vale are stored and moved as integer cents.
 *
 * Boundary rule:
 * - integer numbers/strings are already cents;
 * - decimal numbers or strings with "," are reais and must be converted to cents;
 * - MySQL decimal strings ending in ".00" are treated as already being cents;
 * - display always divides cents by 100.
 */

export function toFiniteNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

export function moneyToCents(value: unknown): number {
    if (value == null || value === '') return 0;

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 0;
        return Number.isInteger(value) ? value : Math.round(value * 100);
    }

    const text = String(value).trim();
    if (!text) return 0;

    const clean = text.replace(/\s/g, '').replace(/^R\$/i, '');
    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');
    const decimalDotMatch = !hasComma ? clean.match(/\.(\d{1,2})$/u) : null;
    const decimalDot = Boolean(decimalDotMatch && decimalDotMatch[1] !== '00');
    const normalized = hasComma
        ? clean.replace(/\./g, '').replace(',', '.')
        : decimalDotMatch && decimalDotMatch[1] === '00'
            ? clean.slice(0, -3).replace(/[.,]/g, '')
            : clean.replace(decimalDot ? /,/g : /[.,]/g, '');

    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return 0;

    const hasDecimalSeparator = hasComma || (hasDot && decimalDot);
    return hasDecimalSeparator ? Math.round(numeric * 100) : Math.round(numeric);
}

export function moneyReaisToCents(value: unknown): number {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : 0;

    const text = String(value).trim();
    if (!text) return 0;

    const clean = text.replace(/\s/g, '').replace(/^R\$/i, '');
    const normalized = clean.includes(',')
        ? clean.replace(/\./g, '').replace(',', '.')
        : clean.replace(/,/g, '');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function formatMoneyCents(value: unknown): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(moneyToCents(value) / 100);
}
