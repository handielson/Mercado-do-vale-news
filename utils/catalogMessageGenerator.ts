import type { Product } from '@/types/product';
import { formatPrice } from '@/services/installmentCalculator';
import { vpsApiService } from '@/services/vpsApiService';

export type CustomerType = 'retail' | 'wholesale' | 'resale';

interface GroupedProduct {
    name: string;
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
 * Calculate installment price (10x with 16% interest)
 */
function calculateInstallment(price: number): { value: number; total: number } {
    const installments = 10;
    const interestRate = 0.16; // 16%
    const total = price * (1 + interestRate);
    const value = total / installments;

    return { value, total };
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

        // Create unique key for variant
        const key = `${product.model || cleanName}-${ram}-${storage}`;

        if (grouped.has(key)) {
            // Add color to existing variant
            const existing = grouped.get(key)!;
            if (!existing.colors.includes(color)) {
                existing.colors.push(color);
            }
        } else {
            // Create new variant entry
            grouped.set(key, {
                name: cleanName,
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

/**
 * Generate catalog message for WhatsApp
 */
export function generateCatalogMessage(
    products: Product[],
    customerType: CustomerType = 'retail',
    categoryName?: string
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

    // Sort by name
    grouped.sort((a, b) => a.name.localeCompare(b.name));

    // Build message
    let message = '';

    if (categoryName) {
        message += `📱 *CATÁLOGO - ${categoryName.toUpperCase()}*\n`;
    } else {
        message += `📚 *CATÁLOGO COMPLETO*\n`;
    }

    message += `📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    grouped.forEach((item, index) => {
        // Calculate installment
        const installment = calculateInstallment(item.price);

        message += `${index + 1}. *${item.name}*\n`;
        message += `   📱 ${item.variant.ram}/${item.variant.storage}\n`;
        message += `   💰 ${formatPrice(item.price)} à vista\n`;
        message += `   💳 10x de ${formatPrice(installment.value)} (${formatPrice(installment.total)})\n`;
        message += `   🎨 Cores: ${item.colors.join(', ')}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Qual desses aparelhos deseja mais informações?*\n`;
    message += `Digite o número ou o modelo escolhido que eu te envio o link do site.\n`;
    message += `🛒 Total: ${grouped.length} ${grouped.length === 1 ? 'modelo' : 'modelos'}`;

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

        return generateCatalogMessage(products, customerType, categoryName);
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

        return generateCatalogMessage(products, customerType);
    } catch (error) {
        console.error('Error generating full catalog:', error);
        return 'Erro ao gerar catálogo completo.';
    }
}
