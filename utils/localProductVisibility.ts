export function isArchivedProductRecord(product: {
    sku?: unknown;
    status?: unknown;
} | null | undefined): boolean {
    const status = String(product?.status || '').trim().toLowerCase();
    const sku = String(product?.sku || '').trim();
    return ['archived', 'deleted'].includes(status) || /^ARCH-/i.test(sku);
}

