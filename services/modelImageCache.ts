import { colorService } from './colors';
import { modelColorImagesService } from './model-color-images';

// Cache em memoria: "mercado-do-vale::[model_id]::[colorName]" -> imageUrl
const memoryCache: Record<string, string | null> = {};
const pendingPromises: Record<string, Promise<string | null>> = {};

/**
 * Pre-carrega imagens de todos os modelos da lista em uma unica chamada logica.
 * Deve ser chamado apos carregar a lista de produtos para evitar N+1 por card.
 */
export async function prefetchModelImages(modelIds: string[]): Promise<void> {
    const unique = [...new Set(modelIds)];
    if (unique.length === 0) return;

    const missing = unique.filter(
        (id) => memoryCache[`mercado-do-vale::${id}::none`] === undefined
    );
    if (missing.length === 0) return;

    try {
        const rows = await modelColorImagesService.getByModelIds(missing);

        const imageByModel: Record<string, string | null> = {};
        for (const row of rows) {
            if (!imageByModel[row.model_id] && row.images?.length) {
                imageByModel[row.model_id] = row.images[0];
            }
        }

        for (const id of missing) {
            const key = `mercado-do-vale::${id}::none`;
            if (memoryCache[key] === undefined) {
                memoryCache[key] = imageByModel[id] ?? null;
            }
        }
    } catch (error) {
        console.error('[modelImageCache] prefetch falhou:', error);
    }
}

export async function getModelImageWithCache(modelId: string, colorName?: string): Promise<string | null> {
    const cacheKey = `mercado-do-vale::${modelId}::${colorName || 'none'}`;

    if (memoryCache[cacheKey] !== undefined) {
        return memoryCache[cacheKey];
    }

    if (pendingPromises[cacheKey]) {
        return pendingPromises[cacheKey];
    }

    const promise = (async () => {
        try {
            let imageUrl: string | null = null;

            if (colorName) {
                const normalizedColorName = colorName.toLowerCase().trim();
                const colorData = (await colorService.list()).find(
                    color => color.name.toLowerCase().trim() === normalizedColorName
                );

                if (colorData?.id) {
                    const row = await modelColorImagesService.get(modelId, colorData.id);
                    if (row?.images?.length) imageUrl = row.images[0];
                }
            }

            if (!imageUrl) {
                const fallbackKey = `mercado-do-vale::${modelId}::none`;
                if (memoryCache[fallbackKey] !== undefined) {
                    imageUrl = memoryCache[fallbackKey];
                } else {
                    const rows = await modelColorImagesService.getByModel(modelId);
                    const firstWithImage = rows.find(row => row.images.length > 0);
                    if (firstWithImage?.images?.length) imageUrl = firstWithImage.images[0];
                }
            }

            memoryCache[cacheKey] = imageUrl;
            return imageUrl;
        } catch (error) {
            console.error('Failed to fetch model image in cache list:', error);
            delete pendingPromises[cacheKey];
            return null;
        }
    })();

    pendingPromises[cacheKey] = promise;
    return promise;
}
