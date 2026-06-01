import { modelColorImagesService as primaryModelColorImagesService } from './model-color-images';

/**
 * Legacy compatibility facade for the older singular-image API.
 * The source of truth is services/model-color-images.ts through VPS table-data.
 */

export interface ModelColorImage {
    id: string;
    company_id: string;
    model_id: string;
    color_id: string;
    image_url: string;
    display_order: number;
    created_at: string;
    updated_at: string;
}

export interface ModelColorImageInput {
    model_id: string;
    color_id: string;
    image_url: string;
    display_order?: number;
}

function toLegacyImages(row: Awaited<ReturnType<typeof primaryModelColorImagesService.get>>): ModelColorImage[] {
    if (!row) return [];
    return row.images.map((imageUrl, index) => ({
        id: index === 0 ? row.id : `${row.id}:${index}`,
        company_id: row.company_id || '',
        model_id: row.model_id,
        color_id: row.color_id,
        image_url: imageUrl,
        display_order: index + 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }));
}

async function getByModelAndColor(modelId: string, colorId: string): Promise<ModelColorImage[]> {
    return toLegacyImages(await primaryModelColorImagesService.get(modelId, colorId));
}

async function create(input: ModelColorImageInput): Promise<ModelColorImage> {
    const existing = await primaryModelColorImagesService.get(input.model_id, input.color_id);
    const images = existing?.images ? [...existing.images] : [];
    const index = Math.max(0, (input.display_order || images.length + 1) - 1);
    images.splice(index, 0, input.image_url);

    const saved = await primaryModelColorImagesService.upsert({
        model_id: input.model_id,
        color_id: input.color_id,
        images,
    });

    return toLegacyImages(saved)[index];
}

async function updateOrder(imageId: string, newOrder: number): Promise<ModelColorImage> {
    const [rowId, indexPart] = imageId.split(':');
    const allRows = await primaryModelColorImagesService.getAll();
    const row = allRows.find(item => item.id === rowId);
    if (!row) throw new Error('Image not found');

    const currentIndex = indexPart ? Number(indexPart) : 0;
    const images = [...row.images];
    const [moved] = images.splice(currentIndex, 1);
    images.splice(Math.max(0, newOrder - 1), 0, moved);

    const saved = await primaryModelColorImagesService.upsert({
        model_id: row.model_id,
        color_id: row.color_id,
        images,
    });
    return toLegacyImages(saved)[Math.max(0, newOrder - 1)];
}

async function reorderAll(modelId: string, colorId: string, imageIds: string[]): Promise<void> {
    const row = await primaryModelColorImagesService.get(modelId, colorId);
    if (!row) return;

    const current = toLegacyImages(row);
    const byId = new Map(current.map(image => [image.id, image.image_url]));
    const images = imageIds.map(id => byId.get(id)).filter((url): url is string => Boolean(url));
    if (images.length > 0) {
        await primaryModelColorImagesService.upsert({ model_id: modelId, color_id: colorId, images });
    }
}

async function deleteImage(imageId: string): Promise<void> {
    const [rowId, indexPart] = imageId.split(':');
    const rows = await primaryModelColorImagesService.getAll();
    const row = rows.find(item => item.id === rowId);
    if (!row) return;

    const index = indexPart ? Number(indexPart) : 0;
    const images = row.images.filter((_, currentIndex) => currentIndex !== index);
    await primaryModelColorImagesService.upsert({ model_id: row.model_id, color_id: row.color_id, images });
}

async function deleteAllByModelAndColor(modelId: string, colorId: string): Promise<void> {
    await primaryModelColorImagesService.remove(modelId, colorId);
}

async function getCoverImage(modelId: string, colorId: string): Promise<ModelColorImage | null> {
    return (await getByModelAndColor(modelId, colorId))[0] || null;
}

async function hasImages(modelId: string, colorId: string): Promise<boolean> {
    return (await getByModelAndColor(modelId, colorId)).length > 0;
}

export const modelColorImageService = {
    getByModelAndColor,
    create,
    updateOrder,
    reorderAll,
    delete: deleteImage,
    deleteAllByModelAndColor,
    getCoverImage,
    hasImages
};
