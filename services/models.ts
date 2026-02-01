import { Model, ModelInput } from '../types/model';
import { supabase } from './supabase';

/**
 * MODEL SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

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
 * Generate URL-friendly slug from model name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * List all models
 */
async function list(): Promise<Model[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch models: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        brand_id: row.brand_id,
        active: true,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get model by ID
 */
async function getById(id: string): Promise<Model | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch model: ${error.message}`);
    }

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        brand_id: data.brand_id,
        active: true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Get models by brand ID
 */
async function listByBrand(brandId: string): Promise<Model[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .eq('brand_id', brandId)
        .order('name');

    if (error) throw new Error(`Failed to fetch models by brand: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        brand_id: row.brand_id,
        active: true,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Create new model
 */
async function create(input: ModelInput): Promise<Model> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('models')
        .insert({
            company_id: companyId,
            brand_id: input.brand_id,
            name: input.name,
            slug
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create model: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        brand_id: data.brand_id,
        active: true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing model
 */
async function update(id: string, input: ModelInput): Promise<Model> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('models')
        .update({
            name: input.name,
            slug,
            brand_id: input.brand_id
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update model: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        brand_id: data.brand_id,
        active: true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Delete model
 */
async function deleteModel(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete model: ${error.message}`);
}

/**
 * Get only active models
 */
async function listActive(): Promise<Model[]> {
    return list();
}

/**
 * Get active models by brand
 */
async function listActiveByBrand(brandId: string): Promise<Model[]> {
    return listByBrand(brandId);
}

export const modelService = {
    list,
    getById,
    listByBrand,
    create,
    update,
    delete: deleteModel,
    listActive,
    listActiveByBrand
};
