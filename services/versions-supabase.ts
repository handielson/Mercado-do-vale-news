
import { Version, VersionInput } from '../types/version';
import { supabase } from './supabase';

/**
 * VERSION SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Multi-tenant with company_id isolation
 * - Follows same pattern as colorService
 * - Manages regional variants (Global, China, USA, etc.)
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
 * Generate URL-friendly slug from version name
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
 * List all versions
 */
async function list(): Promise<Version[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch versions: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active ?? true,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get version by ID
 */
async function getById(id: string): Promise<Version | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch version: ${error.message}`);
    }

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: data.active ?? true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Create new version
 */
async function create(input: VersionInput): Promise<Version> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('versions')
        .insert({
            company_id: companyId,
            name: input.name,
            slug,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create version: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing version
 */
async function update(id: string, input: VersionInput): Promise<Version> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('versions')
        .update({
            name: input.name,
            slug,
            active: input.active !== undefined ? input.active : undefined
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update version: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Delete version
 */
async function deleteVersion(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('versions')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete version: ${error.message}`);
}

/**
 * Get only active versions
 */
async function listActive(): Promise<Version[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

    if (error) throw new Error(`Failed to fetch active versions: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active,
        created: row.created_at,
        updated: row.updated_at
    }));
}

export const versionService = {
    list,
    getById,
    create,
    update,
    delete: deleteVersion,
    listActive
};
