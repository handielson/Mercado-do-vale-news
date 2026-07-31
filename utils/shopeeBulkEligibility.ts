export interface ShopeeBulkStockProduct {
    stock_quantity?: number | null;
    variation_stock_quantity?: number | null;
    track_inventory?: boolean | null;
}

export function getShopeeBulkEffectiveStock(product: ShopeeBulkStockProduct): number {
    if (product.track_inventory === false) return 1;
    const ownStock = Number(product.stock_quantity ?? 0);
    const variationStock = Number(product.variation_stock_quantity ?? 0);
    return Math.max(
        Number.isFinite(ownStock) ? ownStock : 0,
        Number.isFinite(variationStock) ? variationStock : 0,
    );
}

export function hasShopeeBulkPublishStock(product: ShopeeBulkStockProduct): boolean {
    return getShopeeBulkEffectiveStock(product) > 0;
}

