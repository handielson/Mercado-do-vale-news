export const RAM_SPEC_KEYS = ['ram', 'memoria_ram', 'memory_ram'] as const;

export const STORAGE_SPEC_KEYS = [
    'storage',
    'armazenamento',
    'capacidade',
    'memoria',
    'memoria_interna',
    'memory',
    'internal_storage',
] as const;

export function normalizeSpecValue(value: unknown): string {
    if (value === null || value === undefined || typeof value === 'object') return '';
    const formatted = String(value).trim();
    if (!formatted || formatted === 'no-ram' || formatted === 'no-storage') return '';
    return formatted;
}

export function readSpecs(product: any): Record<string, any> {
    if (!product?.specs) return {};
    if (typeof product.specs === 'string') {
        try {
            return JSON.parse(product.specs) || {};
        } catch {
            return {};
        }
    }
    return product.specs;
}

export function readSpecValue(
    specs: Record<string, unknown> | undefined | null,
    keys: readonly string[],
): string {
    const entries = Object.entries(specs || {});
    for (const key of keys) {
        const entry = entries.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
        const value = normalizeSpecValue(entry?.[1]);
        if (value) return value;
    }
    return '';
}

export function getMemorySpecs(productOrSpecs: any): { ram: string; storage: string } {
    const specs = productOrSpecs?.specs ? readSpecs(productOrSpecs) : productOrSpecs;
    return {
        ram: readSpecValue(specs, RAM_SPEC_KEYS),
        storage: readSpecValue(specs, STORAGE_SPEC_KEYS),
    };
}

export function matchesMemorySpecs(product: any, ram: string, storage: string): boolean {
    const memory = getMemorySpecs(product);
    return (
        normalizeSpecValue(memory.ram).toLowerCase() === normalizeSpecValue(ram).toLowerCase() &&
        normalizeSpecValue(memory.storage).toLowerCase() === normalizeSpecValue(storage).toLowerCase()
    );
}
