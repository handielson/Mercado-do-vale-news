import type { CatalogProduct, ProductVariant, ProductGroup } from '@/types/catalog';
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
 * Generate group key from product specs (Brand + Model only)
 */
function generateGroupKey(product: CatalogProduct): string {
    const brand = product.brand || 'unknown';
    const model = product.model || 'unknown';

    return `${brand}_${model}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Generate variant key for RAM + Storage combination
 */
function generateVariantKey(ram?: string, storage?: string): string {
    const normalized = normalizeRAMAndStorage(ram, storage);
    return `${normalized.ram}_${normalized.storage}`.toLowerCase();
}

/**
 * Group products by Brand + Model, with variants for each RAM/Storage combination
 * Each group contains all colors for that variant combination
 */
export function groupProductsByVariants(products: CatalogProduct[]): ProductGroup[] {
    // First, filter only available products
    const availableProducts = filterAvailableProducts(products);

    // Group by model (Brand + Model)
    const modelGroups = new Map<string, CatalogProduct[]>();

    for (const product of availableProducts) {
        const modelKey = generateGroupKey(product);
        const existing = modelGroups.get(modelKey) || [];
        existing.push(product);
        modelGroups.set(modelKey, existing);
    }

    // Convert to ProductGroup array with variants
    const groups: ProductGroup[] = [];

    for (const [modelKey, modelProducts] of modelGroups.entries()) {
        // Group products by RAM + Storage within this model
        const variantMap = new Map<string, CatalogProduct[]>();

        for (const product of modelProducts) {
            const variantKey = generateVariantKey(product.specs?.ram, product.specs?.storage);
            const existing = variantMap.get(variantKey) || [];
            existing.push(product);
            variantMap.set(variantKey, existing);
        }

        // Build variants array
        const variants: ProductVariant[] = [];
        const allColorsMap = new Map<string, ColorOption>();
        let globalMinPrice = Infinity;
        let globalMaxPrice = -Infinity;

        for (const [variantKey, variantProducts] of variantMap.entries()) {
            // Extract unique colors for this variant
            const colorsMap = new Map<string, ColorOption>();
            let minPrice = Infinity;
            let maxPrice = -Infinity;

            for (const product of variantProducts) {
                // Extract color
                if (product.specs?.color) {
                    const colorName = product.specs.color;
                    const colorOption: ColorOption = {
                        name: colorName,
                        hex: product.specs.color_hex || COLOR_MAP[colorName] || '#9CA3AF'
                    };

                    colorsMap.set(colorName, colorOption);
                    allColorsMap.set(colorName, colorOption); // Add to global colors
                }

                // Track price range
                const price = product.price_retail || 0;
                if (price > 0) {
                    minPrice = Math.min(minPrice, price);
                    maxPrice = Math.max(maxPrice, price);
                    globalMinPrice = Math.min(globalMinPrice, price);
                    globalMaxPrice = Math.max(globalMaxPrice, price);
                }
            }

            // Get RAM and Storage from first product
            const firstProduct = variantProducts[0];
            const normalized = normalizeRAMAndStorage(
                firstProduct.specs?.ram,
                firstProduct.specs?.storage
            );

            variants.push({
                ram: normalized.ram,
                storage: normalized.storage,
                colors: Array.from(colorsMap.values()),
                products: variantProducts,
                priceRange: {
                    min: minPrice === Infinity ? 0 : minPrice,
                    max: maxPrice === -Infinity ? 0 : maxPrice
                }
            });
        }

        // Sort variants by RAM (ascending) then Storage (ascending)
        variants.sort((a, b) => {
            const ramA = extractGB(a.ram);
            const ramB = extractGB(b.ram);
            if (ramA !== ramB) return ramA - ramB;

            const storageA = extractGB(a.storage);
            const storageB = extractGB(b.storage);
            return storageA - storageB;
        });

        // Use first product as representative
        const representative = modelProducts[0];

        groups.push({
            groupKey: modelKey,
            brand: representative.brand || '',
            model: representative.model || '',
            variants,
            allColors: Array.from(allColorsMap.values()),
            globalPriceRange: {
                min: globalMinPrice === Infinity ? 0 : globalMinPrice,
                max: globalMaxPrice === -Infinity ? 0 : globalMaxPrice
            },
            representativeProduct: representative
        });
    }

    return groups;
}

/**
 * Find a specific product within a group by RAM, Storage and Color
 */
export function findProductByVariant(
    group: ProductGroup,
    ram: string,
    storage: string,
    colorName: string
): CatalogProduct | null {
    // Find the variant
    const variant = group.variants.find(v => v.ram === ram && v.storage === storage);
    if (!variant) return null;

    // Find the product with the specified color
    return variant.products.find(
        product => product.specs?.color === colorName
    ) || null;
}

/**
 * Get the first available product from a variant (useful for default selection)
 */
export function getDefaultProductFromVariant(variant: ProductVariant): CatalogProduct | null {
    return variant.products[0] || null;
}
