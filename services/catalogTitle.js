// Presentation only: never rewrite product.name or the family/model identity.
export const CATALOG_TITLE_UPDATED_EVENT = 'mdv:catalog-title-updated';

export function applyCatalogTitleUpdate(products, parentId, complement) {
    return products.map(product => product.id === parentId
        ? { ...product, catalog_title_complement: complement }
        : product.parent_id === parentId
            ? { ...product, parent_catalog_title_complement: complement }
            : product);
}

export function getCatalogTitle(baseName, product) {
    const value = product?.parent_id
        ? product.parent_catalog_title_complement
        : product?.catalog_title_complement;
    const complement = typeof value === 'string' ? value.trim() : '';
    return complement ? `${baseName} · ${complement}` : baseName;
}
