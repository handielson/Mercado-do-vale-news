type ProductSpecs = {
    color?: string;
    ram?: string;
    storage?: string;
    [key: string]: string | undefined;
};

const normalizeToken = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

export const productNameAlreadyIncludesColor = (productName: string, color?: string): boolean => {
    if (!color) return false;

    const normalizedName = normalizeToken(productName);
    const normalizedColor = normalizeToken(color);

    if (!normalizedName || !normalizedColor) return false;

    return ` ${normalizedName} `.includes(` ${normalizedColor} `);
};

export const buildPdvProductName = (productName: string, specs?: ProductSpecs | null): string => {
    if (!specs) return productName;

    const memPart = specs.ram && specs.storage
        ? `, ${specs.ram}/${specs.storage}`
        : specs.ram
            ? `, ${specs.ram}`
            : specs.storage
                ? `, ${specs.storage}`
                : '';

    const colorPart = specs.color && !productNameAlreadyIncludesColor(productName, specs.color)
        ? ` - ${specs.color}`
        : '';

    return `${productName}${memPart}${colorPart}`;
};
