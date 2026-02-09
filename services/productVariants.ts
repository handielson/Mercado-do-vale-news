import type { CatalogProduct } from '@/types/catalog';

/**
 * Product variant specifications
 */
export interface VariantSpecs {
    ram?: string;
    storage?: string;
    color?: string;
}

/**
 * Color option with optional hex value
 */
export interface ColorOption {
    name: string;
    hex?: string;
}

/**
 * Extracted product variants
 */
export interface ProductVariants {
    rams: string[];
    storages: string[];
    colors: ColorOption[];
    priceRange: {
        min: number;
        max: number;
    };
}

/**
 * Group products by model_id
 */
export function groupProductsByModel(products: CatalogProduct[]): Map<string, CatalogProduct[]> {
    const grouped = new Map<string, CatalogProduct[]>();

    for (const product of products) {
        const modelId = product.model_id || product.id;
        const existing = grouped.get(modelId) || [];
        existing.push(product);
        grouped.set(modelId, existing);
    }

    return grouped;
}

/**
 * Extract unique variants from a list of products
 */
export function extractVariants(products: CatalogProduct[]): ProductVariants {
    const rams = new Set<string>();
    const storages = new Set<string>();
    const colors = new Map<string, ColorOption>();
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const product of products) {
        // Extract RAM
        if (product.specs?.ram) {
            rams.add(product.specs.ram);
        }

        // Extract Storage
        if (product.specs?.storage) {
            storages.add(product.specs.storage);
        }

        // Extract Color
        if (product.specs?.color) {
            const colorName = product.specs.color;
            if (!colors.has(colorName)) {
                colors.set(colorName, {
                    name: colorName,
                    hex: product.specs.color_hex
                });
            }
        }

        // Track price range
        const price = product.price_retail || 0;
        if (price > 0) {
            minPrice = Math.min(minPrice, price);
            maxPrice = Math.max(maxPrice, price);
        }
    }

    return {
        rams: Array.from(rams).sort(),
        storages: Array.from(storages).sort(),
        colors: Array.from(colors.values()),
        priceRange: {
            min: minPrice === Infinity ? 0 : minPrice,
            max: maxPrice === -Infinity ? 0 : maxPrice
        }
    };
}

/**
 * Find a specific product by variant specifications
 */
export function findProductBySpecs(
    products: CatalogProduct[],
    specs: VariantSpecs
): CatalogProduct | null {
    return products.find(product => {
        const matchRam = !specs.ram || product.specs?.ram === specs.ram;
        const matchStorage = !specs.storage || product.specs?.storage === specs.storage;
        const matchColor = !specs.color || product.specs?.color === specs.color;

        return matchRam && matchStorage && matchColor;
    }) || null;
}
