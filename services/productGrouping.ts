import type { CatalogProduct, ProductVariant, ProductGroup } from '@/types/catalog';
import { ProductStatus } from '@/utils/field-standards';
import { getColorHex } from './colors';

/**
 * Color option with hex value
 */
export interface ColorOption {
    name: string;
    hex?: string;
}

function hasProductMedia(product: CatalogProduct): boolean {
    if (Array.isArray(product.images) && product.images.some(img => typeof img === 'string' && img.trim().length > 0)) {
        return true;
    }

    const imageUrl = (product as any).image_url;
    return typeof imageUrl === 'string' && imageUrl.trim().length > 0;
}

/**
 * Filter products that are available for sale
 * Only products with status = 'active'
 */
export function filterAvailableProducts(products: CatalogProduct[], includeOutOfStock = false): CatalogProduct[] {
    return products.filter(product => {
        // Must be active (available for sale)
        if (product.status !== ProductStatus.ACTIVE) {
            return false;
        }

        // Se não for admin, filtra por estoque
        if (!includeOutOfStock && product.track_inventory && (product.stock_quantity ?? 0) <= 0) {
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
 * Uses model_id (UUID FK) as primary key — reliable and unique per model.
 * Falls back to brand + model name for products without model_id.
 */
export function generateGroupKey(product: CatalogProduct): string {
    // Use model_id (UUID) as the grouping key — most reliable
    if (product.model_id) return product.model_id;

    // Fallback: brand + base name
    const brand = product.brand || 'unknown';
    
    // Prioritize product.name over product.model because Bling often sets model to a generic category (e.g., "Capa de Silicone")
    // If we use that generic category, ALL silicone covers merge into one card.
    let baseName = product.name || product.model || 'unknown';
    
    // Intelligent variant stripping:
    // Bling often appends the variant/color to the end of the product name (e.g. "Capa 360 - Azul" or just "Capa 360 Azul").
    // To correctly group identical siblings without blending completely different models, 
    // we strip known variant values off the very end of the baseName.
    const lowerBase = baseName.toLowerCase();
    const color = product.specs?.color?.trim().toLowerCase();
    const ram = product.specs?.ram?.trim().toLowerCase();
    const storage = product.specs?.storage?.trim().toLowerCase();

    // Check explicitly provided specs first
    if (color && lowerBase.endsWith(color)) {
        baseName = baseName.slice(0, -product.specs.color.length).trim();
    } else if (ram && lowerBase.endsWith(ram)) {
        baseName = baseName.slice(0, -product.specs.ram.length).trim();
    } else if (storage && lowerBase.endsWith(storage)) {
        baseName = baseName.slice(0, -product.specs.storage.length).trim();
    } else {
        // Fallback checks for common colors at the end of the string, if no spec was defined
        const commonColors = ['preto', 'preta', 'branco', 'branca', 'azul', 'vermelho', 'vermelha', 'rosa', 'verde', 'amarelo', 'amarela', 'cinza', 'prata', 'dourado', 'ouro', 'incolor', 'transparente', 'grafite', 'lilas', 'lilás', 'roxo', 'roxa'];
        for (const c of commonColors) {
            if (lowerBase.endsWith(c) && lowerBase !== c) {
                baseName = baseName.slice(0, -c.length).trim();
                break;
            }
        }
    }

    // Clean up trailing separators that might be left over (e.g. "Capa 360 - " -> "Capa 360")
    if (baseName.endsWith('-')) {
        baseName = baseName.slice(0, -1).trim();
    }
    
    // Normaliza: remove artigos PT iniciais ("o ", "a ", "os ", "as ") para agrupar
    const model = baseName.replace(/^(o|a|os|as|um|uma)\s+/i, '');
    const finalKey = `${brand}_${model}`.toLowerCase().replace(/\s+/g, '-');
    
    // TEMPORARY DEBUG LOG FOR CATALOG GROUPS
    if (product.name?.includes('360') || product.name?.includes('Note 60')) {
        console.log(`[GROUP DEBUG] name="${product.name}" color="${color}" -> baseName="${baseName}" -> KEY="${finalKey}"`);
    }
    
    return finalKey;
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
export function groupProductsByVariants(products: CatalogProduct[], includeOutOfStock = false, colorHexMap: Record<string, string> = {}): ProductGroup[] {
    // First, filter only available products
    const availableProducts = filterAvailableProducts(products, includeOutOfStock);

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
                        hex: colorHexMap[colorName] || product.specs.color_hex || getColorHex(colorName) || '#9CA3AF'
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

        // Prioriza representante com imagem para evitar placeholder em cards agrupados.
        const representative = modelProducts.find(hasProductMedia) || modelProducts[0];
        // Derive clean display name from product.name (strip RAM/Storage variant suffix)
        const cleanName = (representative.name || representative.model || '')
            .replace(/,?\s*\d+GB\/\d+GB/gi, '')
            .trim();

        groups.push({
            groupKey: modelKey,
            brand: representative.brand || '',
            model: cleanName,
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
