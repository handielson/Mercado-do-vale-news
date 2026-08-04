import type { CatalogProduct } from '../types/catalog';

export interface MarketingCreativeCard {
    productId: string;
    sku: string;
    name: string;
    priceCents: number;
    stock: number;
    categoryId: string;
    categoryName: string;
    imageUrl: string;
    headline: string;
    callToAction: string;
    whatsappMessage: string;
}

export interface MarketingCreativeSelection {
    storeCarousel: MarketingCreativeCard[];
    smartphoneCarousel: MarketingCreativeCard[];
    generatedAt: string;
}

type CategoryLike = { id?: string; name?: string; slug?: string };

const CARD_LIMIT = 5;

function normalized(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function deterministicNumber(value: string, seed: string): number {
    let hash = 2166136261;
    const input = `${seed}:${value}`;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function firstImage(product: CatalogProduct): string {
    const images = Array.isArray(product.images) ? product.images : [];
    return images.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))?.trim()
        || (typeof (product as any).image_url === 'string' ? (product as any).image_url.trim() : '');
}

function isEligible(product: CatalogProduct): boolean {
    return product.status === 'active'
        && !product.hide_from_catalog
        && !product.is_parent
        && Number(product.stock_quantity || 0) > 0
        && Number(product.price_retail || 0) > 0
        && Boolean(product.sku?.trim())
        && Boolean(firstImage(product));
}

function cardFromProduct(product: CatalogProduct, categoryName: string, smartphone: boolean): MarketingCreativeCard {
    const name = product.name.trim();
    const sku = product.sku.trim();
    return {
        productId: product.id,
        sku,
        name,
        priceCents: Number(product.price_retail || 0),
        stock: Number(product.stock_quantity || 0),
        categoryId: product.category_id || '',
        categoryName: categoryName || 'Loja inteira',
        imageUrl: firstImage(product),
        headline: smartphone ? 'Seu próximo smartphone está aqui' : 'Escolha fácil, compra rápida',
        callToAction: 'Chamar no WhatsApp',
        whatsappMessage: smartphone
            ? `Quero comprar o smartphone: ${name} | Codigo: ${sku}`
            : `Quero comprar: ${name} | Codigo: ${sku}`,
    };
}

function uniqueModelKey(product: CatalogProduct): string {
    return String(product.model_id || normalized(product.name).replace(/\b(\d+\s*(gb|tb)|preto|branco|azul|verde|rosa|roxo|cinza)\b/g, '')).trim();
}

export function selectMarketingCampaignCreatives(
    products: CatalogProduct[],
    categories: CategoryLike[],
    seed = new Date().toISOString().slice(0, 10),
): MarketingCreativeSelection {
    const categoryNames = new Map(categories.map((item) => [String(item.id || ''), String(item.name || item.slug || '')]));
    const smartphoneCategoryIds = new Set(
        categories
            .filter((item) => normalized(`${item.name || ''} ${item.slug || ''}`).includes('smartphone'))
            .map((item) => String(item.id || '')),
    );
    const eligible = products.filter(isEligible);
    const ranked = [...eligible].sort((left, right) => {
        const stockDifference = Math.min(Number(right.stock_quantity || 0), 5) - Math.min(Number(left.stock_quantity || 0), 5);
        if (stockDifference !== 0) return stockDifference;
        return deterministicNumber(left.id, seed) - deterministicNumber(right.id, seed);
    });

    const smartphoneProducts: CatalogProduct[] = [];
    const seenModels = new Set<string>();
    for (const product of ranked) {
        const categoryName = categoryNames.get(product.category_id || '') || '';
        const isSmartphone = smartphoneCategoryIds.has(product.category_id || '') || normalized(categoryName).includes('smartphone');
        if (!isSmartphone) continue;
        const modelKey = uniqueModelKey(product);
        if (seenModels.has(modelKey)) continue;
        seenModels.add(modelKey);
        smartphoneProducts.push(product);
        if (smartphoneProducts.length === CARD_LIMIT) break;
    }

    const storeProducts: CatalogProduct[] = [];
    const seenCategories = new Set<string>();
    const storePool = [...ranked].sort((left, right) => deterministicNumber(left.id, `${seed}:store`) - deterministicNumber(right.id, `${seed}:store`));
    for (const product of storePool) {
        const categoryKey = product.category_id || `sem-categoria:${product.id}`;
        if (seenCategories.has(categoryKey)) continue;
        seenCategories.add(categoryKey);
        storeProducts.push(product);
        if (storeProducts.length === CARD_LIMIT) break;
    }
    if (storeProducts.length < CARD_LIMIT) {
        for (const product of storePool) {
            if (storeProducts.some((item) => item.id === product.id)) continue;
            storeProducts.push(product);
            if (storeProducts.length === CARD_LIMIT) break;
        }
    }

    return {
        storeCarousel: storeProducts.map((product) => cardFromProduct(product, categoryNames.get(product.category_id || '') || '', false)),
        smartphoneCarousel: smartphoneProducts.map((product) => cardFromProduct(product, categoryNames.get(product.category_id || '') || '', true)),
        generatedAt: new Date().toISOString(),
    };
}

export function marketingCreativeSelectionKey(selection: MarketingCreativeSelection): string {
    const ids = [...selection.storeCarousel, ...selection.smartphoneCarousel].map((card) => card.productId).join('|');
    return deterministicNumber(ids, 'marketing-creative-plan-v1').toString(16);
}
