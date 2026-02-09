import type { CatalogProduct } from '@/types/catalog';
import { ProductStatus } from '@/utils/field-standards';
import { COLOR_MAP } from './colors';

/**
 * Color option with hex value
 */
export interface ColorOption {
    name: string;
    hex?: string;
}

/**
 * Product group by variant combination
 */
export interface ProductGroup {
    groupKey: string;
    brand: string;
    model: string;
    ram: string;
    storage: string;
    colors: ColorOption[];
    products: CatalogProduct[];
    priceRange: { min: number; max: number };
    representativeProduct: CatalogProduct; // Product to display in card
}

/**
 * Filter products that are available for sale
 * Only products with status = 'active'
 */
export function filterAvailableProducts(products: CatalogProduct[]): CatalogProduct[] {
    return products.filter(product => {
        // Must be active (available for sale)
        if (product.status !== ProductStatus.ACTIVE) {
            return false;
        }

        // If tracking inventory, must have stock
        if (product.track_inventory && (product.stock_quantity ?? 0) <= 0) {
            return false;
        }

        return true;
    });
}

/**
 * Extract numeric value from storage string (e.g., "256GB" -> 256)
 */
function extractGB(value?: string): number {
    if (!value) return 0;
    const match = value.match(/(\d+)\s*GB/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Normalize RAM and Storage values, detecting and fixing inversions
 * RAM is typically 4GB-16GB, Storage is typically 64GB-1TB
 */
function normalizeRAMAndStorage(ram?: string, storage?: string): { ram: string; storage: string } {
    const ramGB = extractGB(ram);
    const storageGB = extractGB(storage);

    // If both values exist and RAM > Storage, they're likely inverted
    if (ramGB > 0 && storageGB > 0 && ramGB > storageGB) {
        // Swap them
        return {
            ram: `${storageGB}GB`,
            storage: `${ramGB}GB`
        };
    }

    // Return normalized values
    return {
        ram: ramGB > 0 ? `${ramGB}GB` : 'no-ram',
        storage: storageGB > 0 ? `${storageGB}GB` : 'no-storage'
    };
}

/**
 * Generate group key from product specs
 */
function generateGroupKey(product: CatalogProduct): string {
    const brand = product.brand || 'unknown';
    const model = product.model || 'unknown';
    const normalized = normalizeRAMAndStorage(product.specs?.ram, product.specs?.storage);

    return `${brand}_${model}_${normalized.ram}_${normalized.storage}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Group products by Brand + Model + RAM + Storage
 * Each group contains all colors for that variant combination
 */
export function groupProductsByVariants(products: CatalogProduct[]): ProductGroup[] {
    // First, filter only available products
    const availableProducts = filterAvailableProducts(products);

    // Group by variant key
    const grouped = new Map<string, CatalogProduct[]>();

    for (const product of availableProducts) {
        const key = generateGroupKey(product);
        const existing = grouped.get(key) || [];
        existing.push(product);
        grouped.set(key, existing);
    }

    // Convert to ProductGroup array
    const groups: ProductGroup[] = [];

    for (const [key, groupProducts] of grouped.entries()) {
        // Extract unique colors
        const colorsMap = new Map<string, ColorOption>();
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        for (const product of groupProducts) {
            // Extract color
            if (product.specs?.color) {
                const colorName = product.specs.color;
                if (!colorsMap.has(colorName)) {
                    colorsMap.set(colorName, {
                        name: colorName,
                        hex: product.specs.color_hex || COLOR_MAP[colorName] || '#9CA3AF'
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

        // Use first product as representative
        const representative = groupProducts[0];

        groups.push({
            groupKey: key,
            brand: representative.brand || '',
            model: representative.model || '',
            ram: representative.specs?.ram || '',
            storage: representative.specs?.storage || '',
            colors: Array.from(colorsMap.values()),
            products: groupProducts,
            priceRange: {
                min: minPrice === Infinity ? 0 : minPrice,
                max: maxPrice === -Infinity ? 0 : maxPrice
            },
            representativeProduct: representative
        });
    }

    return groups;
}

/**
 * Find a specific product within a group by color
 */
export function findProductByColor(
    group: ProductGroup,
    colorName: string
): CatalogProduct | null {
    return group.products.find(
        product => product.specs?.color === colorName
    ) || null;
}
