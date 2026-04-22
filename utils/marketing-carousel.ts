export type MarketingExportFormat = 'feed' | 'status' | 'sticker';

export interface MarketingExportSlide {
    imageUrl: string | null;
    slideNumber: number;
    totalSlides: number;
}

export interface MarketingBulkExportSlide<TProduct> extends MarketingExportSlide {
    product: TProduct;
    productIndex: number;
}

export const getMarketingExportSlides = (
    images: string[],
    _format: MarketingExportFormat,
): MarketingExportSlide[] => {
    const usableImages = images
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (usableImages.length > 1) {
        return usableImages.map((imageUrl, index) => ({
            imageUrl,
            slideNumber: index + 1,
            totalSlides: usableImages.length,
        }));
    }

    return [{
        imageUrl: usableImages[0] ?? null,
        slideNumber: 1,
        totalSlides: 1,
    }];
};

export const getMarketingBulkExportSlides = <TProduct>(
    products: TProduct[],
    getImages: (product: TProduct) => string[],
    format: MarketingExportFormat,
): MarketingBulkExportSlide<TProduct>[] => {
    return products.flatMap((product, productIndex) => {
        return getMarketingExportSlides(getImages(product), format).map((slide) => ({
            ...slide,
            product,
            productIndex,
        }));
    });
};
