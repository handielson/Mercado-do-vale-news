import { Category, CategoryInput } from '../types/category';
import { supabase } from './supabase';
import { vpsApiService } from './vpsApiService';

/**
 * CATEGORY SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

// TEMPORARY: Hardcoded company_id until we implement auth
// This will be replaced with auth.user.company_id after auth implementation
const TEMP_COMPANY_ID = 'mercado-do-vale'; // Will get from companies table

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
 * List all categories for the current company
 */
async function list(): Promise<Category[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`);

    // Transform Supabase data to our Category type
    return (data || []).map(row => ({
        id: row.id,
        parent_id: row.parent_id,
        name: row.name,
        slug: row.slug,
        config: row.config,
        warranty_days: row.warranty_days || 90,
        extended_warranty_enabled: row.extended_warranty_enabled ?? false,
        margin_wholesale: row.margin_wholesale,
        margin_reseller: row.margin_reseller,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Create a new category
 */
async function create(input: CategoryInput): Promise<Category> {
    const companyId = await getCompanyId();

    const slug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
        .from('categories')
        .insert({
            company_id: companyId,
            parent_id: input.parent_id || null,
            name: input.name,
            slug,
            config: input.config,
            warranty_days: input.warranty_days || 90,
            extended_warranty_enabled: input.extended_warranty_enabled ?? false,
            margin_wholesale: input.margin_wholesale,
            margin_reseller: input.margin_reseller
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create category: ${error.message}`);

    const result = {
        id: data.id,
        parent_id: data.parent_id,
        name: data.name,
        slug: data.slug,
        config: data.config,
        warranty_days: data.warranty_days || 90,
        extended_warranty_enabled: data.extended_warranty_enabled ?? false,
        margin_wholesale: data.margin_wholesale,
        margin_reseller: data.margin_reseller,
        created: data.created_at,
        updated: data.updated_at
    };

    vpsApiService.syncCategory({ ...data, company_id: data.company_id }).catch(console.warn);

    return result;
}

/**
 * Get category by ID
 */
async function getById(id: string): Promise<Category | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch category: ${error.message}`);
    }

    return {
        id: data.id,
        parent_id: data.parent_id,
        name: data.name,
        slug: data.slug,
        config: data.config,
        warranty_days: data.warranty_days || 90,
        extended_warranty_enabled: data.extended_warranty_enabled ?? false,
        margin_wholesale: data.margin_wholesale,
        margin_reseller: data.margin_reseller,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update category
 */
async function update(id: string, input: CategoryInput): Promise<Category> {
    const companyId = await getCompanyId();

    const slug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // UPDATE sem .select() para evitar bloqueio de RLS (mesmo fix de brands.ts)
    const { error } = await supabase
        .from('categories')
        .update({
            parent_id: input.parent_id || null,
            name: input.name,
            slug,
            config: input.config,
            warranty_days: input.warranty_days || 90,
            extended_warranty_enabled: input.extended_warranty_enabled ?? false,
            margin_wholesale: input.margin_wholesale,
            margin_reseller: input.margin_reseller
        })
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to update category: ${error.message}`);

    // SELECT separado após UPDATE (tem permissão de leitura)
    const updated = await getById(id);
    if (!updated) throw new Error('Category not found after update.');

    vpsApiService.updateCategory(id, {
        parent_id: input.parent_id || null,
        name: input.name,
        slug,
        config: input.config,
        warranty_days: input.warranty_days || 90,
        extended_warranty_enabled: input.extended_warranty_enabled ?? false,
        margin_wholesale: input.margin_wholesale,
        margin_reseller: input.margin_reseller
    }).catch(console.warn);

    return updated;
}

/**
 * Delete category
 */
async function remove(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete category: ${error.message}`);

    vpsApiService.deleteCategory(id).catch(console.warn);
}

/**
 * Update sort_order for multiple categories at once
 */
async function updateSortOrder(orders: { id: string; sort_order: number }[]): Promise<void> {
    const updates = orders.map(({ id, sort_order }) =>
        supabase.from('categories').update({ sort_order }).eq('id', id)
    );
    await Promise.all(updates);
}

export const categoryService = {
    list,
    create,
    getById,
    update,
    remove,
    updateSortOrder
};
