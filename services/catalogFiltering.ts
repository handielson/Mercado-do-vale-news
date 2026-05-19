export function filterBySelectedCategories<T extends { category_id?: string | null }>(
    products: T[],
    categoryIds?: string[],
): T[] {
    const selectedCategoryIds = (categoryIds || []).filter(Boolean);
    if (selectedCategoryIds.length === 0) return products;

    const selected = new Set(selectedCategoryIds);
    return products.filter(product => product.category_id ? selected.has(product.category_id) : false);
}
