/**
 * Model-Color Images Service
 * Manages images for model-color variations
 */

import { supabase } from './supabase';

export interface ModelColorImages {
    id: string;
    model_id: string;
    color_id: string;
    images: string[];
    created_at: string;
    updated_at: string;
}

export interface ModelColorImagesInput {
    model_id: string;
    color_id: string;
    images: string[];
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
 * Get images for a specific model-color variation
 */
async function get(modelId: string, colorId: string): Promise<ModelColorImages | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('model_color_images')
        .select('*')
        .eq('company_id', companyId)
        .eq('model_id', modelId)
        .eq('color_id', colorId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch images: ${error.message}`);
    }

    return data;
}

/**
 * Get all images for a model (all colors)
 */
async function getByModel(modelId: string): Promise<ModelColorImages[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('model_color_images')
        .select('*')
        .eq('company_id', companyId)
        .eq('model_id', modelId)
        .order('created_at');

    if (error) throw new Error(`Failed to fetch images: ${error.message}`);
    return data || [];
}

/**
 * Create or update images for a model-color variation
 */
async function upsert(input: ModelColorImagesInput): Promise<ModelColorImages> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('model_color_images')
        .upsert({
            company_id: companyId,
            model_id: input.model_id,
            color_id: input.color_id,
            images: input.images,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'company_id,model_id,color_id'
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to save images: ${error.message}`);
    return data;
}

/**
 * Delete images for a model-color variation
 */
async function remove(modelId: string, colorId: string): Promise<void> {
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
 * Get images for a product (custom or default)
 */
async function getProductImages(product: {
    custom_images?: string[] | null;
    model_id: string;
    color_id: string;
}): Promise<string[]> {
    // If product has custom images, use them
    if (product.custom_images && product.custom_images.length > 0) {
        return product.custom_images;
    }

    // Otherwise, get default images from model-color variation
    const variantImages = await get(product.model_id, product.color_id);
    return variantImages?.images || [];
}

export const modelColorImagesService = {
    get,
    getByModel,
    upsert,
    remove,
    getProductImages
};
