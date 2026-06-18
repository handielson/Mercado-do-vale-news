import type { Product } from '@/types/product';
import { calculateInstallmentFromFees, calculatePixPrice, formatPrice } from '@/services/installmentCalculator';
import { paymentFeesService, type PaymentFee } from '@/services/payment-fees';
import { vpsApiService } from '@/services/vpsApiService';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';

export type CustomerType = 'retail' | 'wholesale' | 'resale';

interface GroupedProduct {
    name: string;
    brand: string;
    model: string;
    variant: {
        ram: string;
        storage: string;
    };
    colors: string[];
    price: number;
    installmentPrice: number;
    installmentTotal: number;
}

/**
 * Get price based on customer type
 */
function getPriceForCustomer(product: Product, customerType: CustomerType): number {
    switch (customerType) {
        case 'retail':
            return product.price_retail;
        case 'wholesale':
            return product.price_wholesale || product.price_retail;
        case 'resale':
            return product.price_reseller || product.price_wholesale || product.price_retail;
        default:
            return product.price_retail;
    }
}

/**
 * Group products by variant (model + RAM + Storage)
 */
function groupProductsByVariant(products: Product[]): GroupedProduct[] {
    const grouped = new Map<string, GroupedProduct>();

    products.forEach(product => {
        // Clean product name (remove RAM/Storage if present)
        const cleanName = product.name.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();

        const ram = product.specs?.ram || 'N/A';
        const storage = product.specs?.storage || 'N/A';
        const color = product.specs?.color || 'Sem cor';
        const brand = product.brand || 'Sem marca';

        // Create unique key for variant
        const key = `${product.model || cleanName}-${ram}-${storage}`;

        if (grouped.has(key)) {
            // Add color to existing variant
            const existing = grouped.get(key)!;
            if (!existing.colors.includes(color)) {
                existing.colors.push(color);
            }
            if (product.price_retail > 0 && product.price_retail < existing.price) {
                existing.price = product.price_retail;
            }
        } else {
            // Create new variant entry
            grouped.set(key, {
                name: cleanName,
                brand,
                model: product.model || cleanName,
                variant: { ram, storage },
                colors: [color],
                price: product.price_retail, // Will be updated based on customer type
                installmentPrice: 0,
                installmentTotal: 0
            });
        }
    });

    return Array.from(grouped.values());
}

function groupCatalogItemsByBrand(items: GroupedProduct[]): Array<{ brand: string; items: GroupedProduct[] }> {
    const groups = new Map<string, GroupedProduct[]>();

    for (const item of items) {
        const brand = item.brand || 'Sem marca';
        const brandItems = groups.get(brand) || [];
        brandItems.push(item);
        groups.set(brand, brandItems);
    }

    return Array.from(groups.entries())
        .sort(([brandA], [brandB]) => brandA.localeCompare(brandB, 'pt-BR'))
        .map(([brand, brandItems]) => ({
            brand,
            items: brandItems.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'pt-BR')),
        }));
}

function hasAvailableStock(product: Product): boolean {
    return Number(product.stock_quantity || 0) > 0;
}

function normalizeProducts(rows: unknown[] | null): Product[] {
    return (rows || []).map((row) => row as Product).filter(hasAvailableStock);
}

async function getCategoryName(categoryId: string): Promise<string | undefined> {
    const categories = await vpsApiService.getCategories();
    const category = (categories || []).find((item: any) => String(item.id) === String(categoryId));
    return category?.name ? String(category.name) : undefined;
}

function getCatalogOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return 'https://mercadodovale.com.br';
}

function buildCatalogUrl(categoryName?: string): string {
    const origin = getCatalogOrigin();
    if (!categoryName) return `${origin}/`;
    return `${origin}/?categoria=${encodeURIComponent(categoryName)}`;
}

/**
 * Generate catalog message for WhatsApp
 */
export function generateCatalogMessage(
    products: Product[],
    customerType: CustomerType = 'retail',
    categoryName?: string,
    catalogUrl: string = buildCatalogUrl(categoryName),
    paymentFees: PaymentFee[] = [],
    pixDiscountPercent: number = 0
): string {
    if (products.length === 0) {
        return 'Nenhum produto disponível no momento.';
    }

    // Update prices based on customer type
    const productsWithPrices = products.map(p => ({
        ...p,
        price_retail: getPriceForCustomer(p, customerType)
    }));

    // Group products by variant
    const grouped = groupProductsByVariant(productsWithPrices);
    const groupedByBrand = groupCatalogItemsByBrand(grouped);

    // Build message
    let message = '';

    if (categoryName) {
        message += `📱 *CATÁLOGO - ${categoryName.toUpperCase()}*\n`;
    } else {
        message += `📚 *CATÁLOGO COMPLETO*\n`;
    }

    message += `📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    let productIndex = 1;

    groupedByBrand.forEach(({ brand, items }) => {
        message += `*${brand}*\n\n`;

        items.forEach((item) => {
            const pixPrice = calculatePixPrice(item.price, pixDiscountPercent);
            const installment = calculateInstallmentFromFees(item.price, paymentFees, 12);
            const pixDiscountLabel = pixDiscountPercent > 0 ? ` (${pixDiscountPercent}% de desconto)` : '';

            message += `${productIndex++}. *${item.name}*\n`;
            message += `   📱 ${item.variant.ram}/${item.variant.storage}\n`;
            message += `   💰 ${formatPrice(pixPrice)} à vista no PIX${pixDiscountLabel}\n`;
            message += `   💳 Cartão: 12x de ${formatPrice(installment.value)} (total ${formatPrice(installment.total)})\n`;
            message += `   🎨 Cores: ${item.colors.join(', ')}\n\n`;
        });
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Gostou de algum desses?*\n`;
    message += `Veja no site: ${catalogUrl}`;

    return message;
}

/**
 * Generate catalog message for a specific category
 */
export async function generateCategoryMessage(
    categoryId: string,
    customerType: CustomerType = 'retail'
): Promise<string> {
    try {
        const [categoryName, productRows] = await Promise.all([
            getCategoryName(categoryId),
            vpsApiService.getProducts({ category: categoryId, status: 'active', limit: 1000, noCache: true }),
        ]);
        const products = normalizeProducts(productRows);

        if (!products || products.length === 0) {
            return 'Nenhum produto disponível nesta categoria.';
        }

        const [paymentFees, companySettings] = await Promise.all([
            paymentFeesService.list(),
            publicCompanySettingsService.get(),
        ]);
        return generateCatalogMessage(products, customerType, categoryName, buildCatalogUrl(categoryName), paymentFees, Number(companySettings?.pix_discount_percentage || 0));
    } catch (error) {
        console.error('Error generating category message:', error);
        return 'Erro ao gerar catálogo da categoria.';
    }
}

/**
 * Generate full catalog message (all categories)
 */
export async function generateFullCatalogMessage(
    customerType: CustomerType = 'retail'
): Promise<string> {
    try {
        const productRows = await vpsApiService.getProducts({ status: 'active', limit: 1000, noCache: true });
        const products = normalizeProducts(productRows);

        if (!products || products.length === 0) {
            return 'Nenhum produto disponível no catálogo.';
        }

        const [paymentFees, companySettings] = await Promise.all([
            paymentFeesService.list(),
            publicCompanySettingsService.get(),
        ]);
        return generateCatalogMessage(products, customerType, undefined, buildCatalogUrl(), paymentFees, Number(companySettings?.pix_discount_percentage || 0));
    } catch (error) {
        console.error('Error generating full catalog:', error);
        return 'Erro ao gerar catálogo completo.';
    }
}
