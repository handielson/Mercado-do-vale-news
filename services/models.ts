import { Model, ModelInput } from '../types/model';
import { supabase } from './supabase';

/**
 * MODEL SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

// Cache global de companyId vive em ./companyContext (lê VITE_COMPANY_ID, fallback para Supabase).
// Antes desta consolidação, cada service repetia o lookup → 3+ chamadas idênticas na home.
import { getCompanyId } from './companyContext';

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
        updated: row.updated_at,
        // Template fields
        category_id: row.category_id,
        description: row.description,
        template_values: row.template_values,
        // EAN codes
        eans: row.eans
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
        updated: data.updated_at,
        // Template fields
        category_id: data.category_id,
        description: data.description,
        template_values: data.template_values,
        // EAN codes
        eans: data.eans
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
        updated: row.updated_at,
        // Template fields
        category_id: row.category_id,
        description: row.description,
        template_values: row.template_values,
        // EAN codes
        eans: row.eans
    }));
}

/**
 * Create new model
 */
async function create(input: ModelInput): Promise<Model> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const toModel = (row: any): Model => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        brand_id: row.brand_id,
        active: true,
        created: row.created_at,
        updated: row.updated_at,
        category_id: row.category_id,
        description: row.description,
        template_values: row.template_values,
        eans: row.eans,
    });

    // Evita 409 previsivel: se o modelo ja existir, reaproveita.
    const { data: existingBeforeInsert, error: existingBeforeInsertError } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .eq('slug', slug)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!existingBeforeInsertError && existingBeforeInsert && existingBeforeInsert.length > 0) {
        return toModel(existingBeforeInsert[0]);
    }

    // Fallback por nome para cenarios legados com slug divergente
    const { data: existingByName, error: existingByNameError } = await supabase
        .from('models')
        .select('*')
        .eq('company_id', companyId)
        .ilike('name', input.name)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!existingByNameError && existingByName && existingByName.length > 0) {
        return toModel(existingByName[0]);
    }

    const { data, error } = await supabase
        .from('models')
        .insert({
            company_id: companyId,
            brand_id: input.brand_id,
            name: input.name,
            slug,
            // Template fields
            category_id: input.category_id,
            description: input.description,
            template_values: input.template_values || {},
            // EAN codes
            eans: input.eans
        })
        .select()
        .single();

    if (error) {
        const msg = (error.message || '').toLowerCase();
        const isConflict = error.code === '23505' || msg.includes('duplicate') || msg.includes('unique') || msg.includes('409');

        if (isConflict) {
            const { data: existingAfterConflict, error: existingAfterConflictError } = await supabase
                .from('models')
                .select('*')
                .eq('company_id', companyId)
                .eq('slug', slug)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!existingAfterConflictError && existingAfterConflict && existingAfterConflict.length > 0) {
                return toModel(existingAfterConflict[0]);
            }

            const { data: existingAfterConflictByName, error: existingAfterConflictByNameError } = await supabase
                .from('models')
                .select('*')
                .eq('company_id', companyId)
                .ilike('name', input.name)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!existingAfterConflictByNameError && existingAfterConflictByName && existingAfterConflictByName.length > 0) {
                return toModel(existingAfterConflictByName[0]);
            }
        }

        throw new Error(`Failed to create model: ${error.message}`);
    }

    return toModel(data);
}

/**
 * Update existing model
 */
async function update(id: string, input: ModelInput): Promise<Model> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { error } = await supabase
        .from('models')
        .update({
            name: input.name,
            slug,
            brand_id: input.brand_id,
            category_id: input.category_id,
            description: input.description,
            template_values: input.template_values,
            eans: input.eans
        })
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to update model: ${error.message}`);

    const updated = await getById(id);
    if (!updated) throw new Error('Model not found after update.');
    return updated;
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
