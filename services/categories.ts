import { Category, CategoryInput } from '../types/category';
import { supabase } from './supabase';

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
        .order('name');

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`);

    // Transform Supabase data to our Category type
    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        config: row.config,
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
            name: input.name,
            slug,
            config: input.config
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create category: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        config: data.config,
        created: data.created_at,
        updated: data.updated_at
    };
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
        name: data.name,
        slug: data.slug,
        config: data.config,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update category
 */
async function update(id: string, input: CategoryInput): Promise<Category> {
    const companyId = await getCompanyId();

    console.log('💾 [CategoryService] Updating category:', id);
    console.log('📝 [CategoryService] Input config:', JSON.stringify(input.config, null, 2));
    console.log('🔢 [CategoryService] Custom fields count:', input.config?.custom_fields?.length || 0);

    const slug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
        .from('categories')
        .update({
            name: input.name,
            slug,
            config: input.config
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update category: ${error.message}`);

    console.log('✅ [CategoryService] Saved config:', JSON.stringify(data.config, null, 2));
    console.log('✅ [CategoryService] Saved custom fields:', data.config?.custom_fields?.length || 0);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        config: data.config,
        created: data.created_at,
        updated: data.updated_at
    };
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
}

export const categoryService = {
    list,
    create,
    getById,
    update,
    remove
};
