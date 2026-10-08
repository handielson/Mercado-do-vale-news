// Presentation only: never rewrite product.name or the family/model identity.
export function getCatalogTitle(baseName, product) {
    const value = product?.parent_id
        ? product.parent_catalog_title_complement
        : product?.catalog_title_complement;
    const complement = typeof value === 'string' ? value.trim() : '';
    return complement ? `${baseName} · ${complement}` : baseName;
}
