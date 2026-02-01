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
        active: true, // Not in DB schema yet, default to true
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
        active: true,
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
            slug
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create brand: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing brand
 */
async function update(id: string, input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('brands')
        .update({
            name: input.name,
            slug
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update brand: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Delete brand
 */
async function deleteBrand(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete brand: ${error.message}`);
}

/**
 * Get only active brands (all brands for now since we don't have active field)
 */
async function listActive(): Promise<Brand[]> {
    return list();
}

export const brandService = {
    list,
    getById,
    create,
    update,
    delete: deleteBrand,
    listActive
};
