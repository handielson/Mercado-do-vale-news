export function filterBySelectedCategories<T extends { category_id?: string | null }>(
    products: T[],
    categoryIds?: string[],
): T[] {
    const selectedCategoryIds = (categoryIds || []).filter(Boolean);
    if (selectedCategoryIds.length === 0) return products;

    const selected = new Set(selectedCategoryIds);
    return products.filter(product => product.category_id ? selected.has(product.category_id) : false);
}

const normalizedText = (value: unknown): string => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Somente a consulta de tecnologia isolada muda de significado. Nomes de
// acessórios, SKU (KA-322-5G), "Wi-Fi 5GHz" e memória "5GB" continuam textuais.
export function getCatalogNetworkQuery(search: string): '4G' | '5G' | undefined {
    const match = normalizedText(search).match(/^(?:(?:celular(?:es)?|smartphones?)\s+)?([45])\s*g(?:\s+(?:celular(?:es)?|smartphones?))?$/);
    return match ? `${match[1]}G` as '4G' | '5G' : undefined;
}

export function getSmartphoneCategoryIds(categories: Array<{ id: string; name?: string; slug?: string }>): string[] {
    return categories.filter(category =>
        /^(?:celular(?:es)?|smartphones?)$/.test(normalizedText(category.name)) ||
        /^(?:celular(?:es)?|smartphones?)$/.test(normalizedText(category.slug))
    ).map(category => category.id);
}

export function matchesCatalogNetwork(product: Record<string, any>, network: '4G' | '5G'): boolean {
    // An empty model field means unknown; stale variation copies are never authority.
    const template = product.model_template_values || {};
    const value = template.rede_operadora ?? template['specs.rede_operadora'] ?? template.network ?? template.rede;
    const text = normalizedText(value);
    // Não confundir 5GHz, 5GB ou negar uma característica ("não suporta 5G").
    if (new RegExp(`\\b(?:nao|sem|not|no)\\s+(?:(?:suporta|suporte|support)\\s+(?:a\\s+)?)?${network[0]}\\s*g\\b`).test(text)) return false;
    return new RegExp(`(?:^|[^a-z0-9])${network[0]}\\s*g(?:$|[^a-z0-9])`, 'i').test(text);
}

export function applyCatalogSearchFilters<T extends Record<string, any>>(
    products: T[],
    filters: {
        categories?: string[]; brands?: string[]; priceRange?: [number, number];
        inStockOnly?: boolean; featuredOnly?: boolean; newOnly?: boolean;
        sortBy?: string;
    } | undefined,
    newProductDays = 30,
    now = Date.now(),
): T[] {
    let result = filterBySelectedCategories(products, filters?.categories);
    if (filters?.inStockOnly) result = result.filter(p => !p.track_inventory || p.stock_quantity > 0);
    if (filters?.brands?.length) {
        const brands = new Set(filters.brands.map(normalizedText));
        result = result.filter(p => brands.has(normalizedText(p.brand)));
    }
    if (filters?.priceRange) {
        const [min, max] = filters.priceRange;
        result = result.filter(p => p.price_retail >= min && p.price_retail <= max);
    }
    const featured = (p: T) => p.custom_fields?.featured === true;
    if (filters?.featuredOnly) result = result.filter(featured);
    const createdAt = (p: T) => new Date(p.created_at || 0).getTime() || 0;
    if (filters?.newOnly) {
        const cutoff = now - Math.max(0, newProductDays) * 86400000;
        result = result.filter(p => createdAt(p) >= cutoff && createdAt(p) <= now);
    }
    result = [...result];
    switch (filters?.sortBy) {
        case 'price_asc': result.sort((a, b) => a.price_retail - b.price_retail); break;
        case 'price_desc': result.sort((a, b) => b.price_retail - a.price_retail); break;
        case 'featured': result.sort((a, b) => Number(featured(b)) - Number(featured(a)) || createdAt(b) - createdAt(a)); break;
        default: result.sort((a, b) => createdAt(b) - createdAt(a));
    }
    return result;
}
