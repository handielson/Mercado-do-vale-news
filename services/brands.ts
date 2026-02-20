import { Brand, BrandInput } from '../types/brand';
import { supabase } from './supabase';

/**
 * BRAND SERVICE - Supabase Implementation
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
 * Generate URL-friendly slug from brand name
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
 * List all brands
 */
async function list(): Promise<Brand[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch brands: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active ?? true,
        warranty_days: row.warranty_days || 90,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get brand by ID
 */
async function getById(id: string): Promise<Brand | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch brand: ${error.message}`);
    }

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: data.active ?? true,
        warranty_days: data.warranty_days || 90,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Create new brand
 */
async function create(input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('brands')
        .insert({
            company_id: companyId,
            name: input.name,
            slug,
            warranty_days: input.warranty_days || 90,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create brand: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: data.active ?? true,
        warranty_days: data.warranty_days || 90,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing brand + cascade: sync brand name in products table
 */
async function update(id: string, input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    // 1. Fetch current name before updating (needed for cascading)
    const { data: current, error: fetchError } = await supabase
        .from('brands')
        .select('name')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle();

    if (fetchError) throw new Error(`Failed to fetch brand: ${fetchError.message}`);

    const oldName = current?.name;

    // 2. Update — no .select() to avoid RLS blocking returned rows
    const updatePayload: Record<string, unknown> = {
        name: input.name,
        slug,
        warranty_days: input.warranty_days || 90,
    };
    if (input.active !== undefined) {
        updatePayload.active = input.active;
    }

    const { error } = await supabase
        .from('brands')
        .update(updatePayload)
        .eq('id', id);

    if (error) throw new Error(`Failed to update brand: ${error.message}`);

    // 3. Cascade: update brand name in products table
    if (oldName && oldName !== input.name) {
        await supabase
            .from('products')
            .update({ brand: input.name })
            .eq('brand', oldName);
    }

    // 4. Fetch updated brand via separate SELECT
    const updated = await getById(id);
    if (!updated) throw new Error('Brand not found after update.');
    return updated;
}


/**
 * Delete brand
 */
async function deleteBrand(id: string): Promise<void> {
    const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete brand: ${error.message}`);
}


/**
 * Get only active brands (all brands for now since we don't have active field)
 */
async function listActive(): Promise<Brand[]> {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

    if (error) throw new Error(`Failed to fetch active brands: ${error.message}`);
    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active ?? true,
        warranty_days: row.warranty_days || 90,
        created: row.created_at,
        updated: row.updated_at
    }));
}

export const brandService = {
    list,
    getById,
    create,
    update,
    delete: deleteBrand,
    listActive
};
