import { supabase } from './supabase';

/**
 * MODEL COLOR IMAGE SERVICE
 * Manages shared image galleries for Model+Color combinations
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Images are shared across all NEW products with same Model+Color
 * - USED products use individual images (products.images[])
 * - Supports drag & drop reordering via display_order
 * - First image (display_order=1) is always the cover/main image
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

// TEMPORARY: Hardcoded company_id until we implement auth
const TEMP_COMPANY_ID = 'mercado-do-vale';

/**
 * Get company_id from companies table by slug
 */
async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', TEMP_COMPANY_ID)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

/**
 * Get all images for a Model+Color combination
 * Ordered by display_order (first image is cover)
 */
async function getByModelAndColor(
    modelId: string,
    colorId: string
): Promise<ModelColorImage[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('model_color_images')
        .select('*')
        .eq('company_id', companyId)
        .eq('model_id', modelId)
        .eq('color_id', colorId)
        .order('display_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch images: ${error.message}`);

    return data || [];
}

/**
 * Add new image to Model+Color gallery
 * Automatically assigns next display_order
 */
async function create(input: ModelColorImageInput): Promise<ModelColorImage> {
    const companyId = await getCompanyId();

    // Get current max display_order
    const existing = await getByModelAndColor(input.model_id, input.color_id);
    const nextOrder = input.display_order ?? (existing.length + 1);

    const { data, error } = await supabase
        .from('model_color_images')
        .insert({
            company_id: companyId,
            model_id: input.model_id,
            color_id: input.color_id,
            image_url: input.image_url,
            display_order: nextOrder
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create image: ${error.message}`);

    return data;
}

/**
 * Update image display order (for drag & drop reordering)
 */
async function updateOrder(
    imageId: string,
    newOrder: number
): Promise<ModelColorImage> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('model_color_images')
        .update({ display_order: newOrder })
        .eq('id', imageId)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update image order: ${error.message}`);

    return data;
}

/**
 * Reorder all images in a Model+Color gallery
 * Used for drag & drop functionality
 */
async function reorderAll(
    modelId: string,
    colorId: string,
    imageIds: string[] // Array of image IDs in new order
): Promise<void> {
    const companyId = await getCompanyId();

    // Update each image with its new position
    const updates = imageIds.map((imageId, index) =>
        supabase
            .from('model_color_images')
            .update({ display_order: index + 1 })
            .eq('id', imageId)
            .eq('company_id', companyId)
            .eq('model_id', modelId)
            .eq('color_id', colorId)
    );

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
        throw new Error(`Failed to reorder images: ${errors[0].error?.message}`);
    }
}

/**
 * Delete image from gallery
 */
async function deleteImage(imageId: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('model_color_images')
        .delete()
        .eq('id', imageId)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete image: ${error.message}`);
}

/**
 * Delete all images for a Model+Color combination
 */
async function deleteAllByModelAndColor(
    modelId: string,
    colorId: string
): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('model_color_images')
        .delete()
        .eq('company_id', companyId)
        .eq('model_id', modelId)
        .eq('color_id', colorId);

    if (error) throw new Error(`Failed to delete images: ${error.message}`);
}

/**
 * Get cover image (first image) for a Model+Color
 */
async function getCoverImage(
    modelId: string,
    colorId: string
): Promise<ModelColorImage | null> {
    const images = await getByModelAndColor(modelId, colorId);
    return images.length > 0 ? images[0] : null;
}

/**
 * Check if Model+Color has any images
 */
async function hasImages(
    modelId: string,
    colorId: string
): Promise<boolean> {
    const images = await getByModelAndColor(modelId, colorId);
    return images.length > 0;
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
