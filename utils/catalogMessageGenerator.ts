import type { Product } from '@/types/product';
import { calculateInstallmentFromFees, calculatePixPrice, formatPrice } from '@/services/installmentCalculator';
import { paymentFeesService, type PaymentFee } from '@/services/payment-fees';
import { vpsApiService } from '@/services/vpsApiService';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';
import { getMemorySpecs } from '@/utils/productSpecUtils';
import {
    buildSharedColorLines,
    formatSharedColor,
    stripSharedProductColorVariation,
} from '@/utils/sharedMessageFormatting';
import { catalogService } from '@/services/catalogService';

export type CustomerType = 'retail' | 'wholesale' | 'resale';

export interface CatalogShareFilters {
    search?: string;
    categories?: string[];
    brands?: string[];
    priceRange?: [number, number];
    inStockOnly?: boolean;
    featuredOnly?: boolean;
    newOnly?: boolean;
    favoritesOnly?: boolean;
    customerId?: string;
    sortBy?: 'recent' | 'price_asc' | 'price_desc' | 'featured';
}

export interface FilteredCatalogShareData {
    products: Product[];
    categoryName?: string;
    filterDescription: string;
    catalogUrl: string;
}

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
        const { ram: rawRam, storage: rawStorage } = getMemorySpecs(product);
        const ram = rawRam || 'N/A';
        const storage = rawStorage || 'N/A';
        const rawColor = product.specs?.color || 'Sem cor';
        const color = formatSharedColor(rawColor);
        // Clean product name (remove color variation and RAM/Storage if present)
        const cleanName = stripSharedProductColorVariation(product.name, rawColor)
            .replace(/,?\s*\d+GB\/\d+GB\s*$/i, '')
            .trim();
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
            items: brandItems.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.price - b.price),
        }));
}

function hasAvailableStock(product: Product): boolean {
    return Number(product.stock_quantity || 0) > 0;
}

function filterCatalogVisibleProducts(products: Product[]): Product[] {
    return products.filter((product) => !product.hide_from_catalog);
}

function normalizeProducts(rows: unknown[] | null): Product[] {
    return filterCatalogVisibleProducts((rows || []).map((row) => row as Product)).filter(hasAvailableStock);
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

function buildFilteredCatalogUrl(): string {
    if (typeof window !== 'undefined' && window.location?.href) return window.location.href;
    return buildCatalogUrl();
}

function describeCatalogFilters(filters: CatalogShareFilters): string {
    const labels: string[] = [];
    const search = String(filters.search || '').trim();
    if (search) labels.push(`Busca: “${search}”`);
    if (filters.brands?.length) labels.push(`Marcas: ${filters.brands.join(', ')}`);
    if (filters.priceRange) labels.push(`Preço: ${formatPrice(filters.priceRange[0])} a ${formatPrice(filters.priceRange[1])}`);
    if (filters.featuredOnly) labels.push('Somente destaques');
    if (filters.newOnly) labels.push('Somente novidades');
    if (filters.favoritesOnly) labels.push('Somente favoritos');
    return labels.join(' • ') || 'Filtros atuais';
}

function applyShareFilters(products: Product[], filters: CatalogShareFilters): Product[] {
    let result = [...products];
    if (filters.brands?.length) result = result.filter(product => product.brand && filters.brands!.includes(product.brand));
    if (filters.priceRange) {
        const [minimum, maximum] = filters.priceRange;
        result = result.filter(product => Number(product.price_retail || 0) >= minimum && Number(product.price_retail || 0) <= maximum);
    }
    if (filters.featuredOnly) result = result.filter(product => product.custom_fields?.featured === true);
    if (filters.newOnly) result = result.filter(product => (product as Product & { is_new?: boolean }).is_new === true);

    const recentTime = (product: Product) => new Date(product.created_at || 0).getTime();
    if (filters.sortBy === 'price_asc') result.sort((left, right) => Number(left.price_retail || 0) - Number(right.price_retail || 0));
    else if (filters.sortBy === 'price_desc') result.sort((left, right) => Number(right.price_retail || 0) - Number(left.price_retail || 0));
    else if (filters.sortBy === 'featured') {
        result.sort((left, right) => Number(right.custom_fields?.featured === true) - Number(left.custom_fields?.featured === true) || recentTime(right) - recentTime(left));
    } else result.sort((left, right) => recentTime(right) - recentTime(left));
    return result;
}

export async function getFilteredCatalogShareData(filters: CatalogShareFilters): Promise<FilteredCatalogShareData> {
    const [result, categoryName] = await Promise.all([
        catalogService.getProducts(filters, 1, 5000, true),
        filters.categories?.[0] ? getCategoryName(filters.categories[0]) : Promise.resolve(undefined),
    ]);
    return {
        products: normalizeProducts(applyShareFilters(result.products as Product[], filters)),
        categoryName,
        filterDescription: describeCatalogFilters(filters),
        catalogUrl: buildFilteredCatalogUrl(),
    };
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
    pixDiscountPercent: number = 0,
    filterDescription?: string
): string {
    products = normalizeProducts(products);

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
    if (filterDescription) message += `🔎 *${filterDescription}*\n\n`;
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
            message += `${buildSharedColorLines(item.colors).join('\n')}\n`;
        });
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Gostou de algum desses?*\n`;
    message += `Veja no site: ${catalogUrl}`;

    return message;
}

/** Generate a message from the search and filters currently applied in the public catalog. */
export async function generateFilteredCatalogMessage(
    filters: CatalogShareFilters,
    customerType: CustomerType = 'retail'
): Promise<string> {
    try {
        const [{ products, categoryName, filterDescription, catalogUrl }, paymentFees, companySettings] = await Promise.all([
            getFilteredCatalogShareData(filters),
            paymentFeesService.list(),
            publicCompanySettingsService.get(),
        ]);
        if (products.length === 0) return 'Nenhum produto disponível com os filtros atuais.';
        return generateCatalogMessage(
            products,
            customerType,
            categoryName,
            catalogUrl,
            paymentFees,
            Number(companySettings?.pix_discount_percentage || 0),
            filterDescription,
        );
    } catch (error) {
        console.error('Error generating filtered catalog message:', error);
        return 'Erro ao gerar catálogo filtrado.';
    }
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
