import { WarrantyTemplate, WarrantyTemplateInput } from '../types/warranty';
import { supabase } from './supabase';

/**
 * WARRANTY TEMPLATE SERVICE - Supabase Implementation
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
 * List all warranty templates for the current company
 */
async function list(): Promise<WarrantyTemplate[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('warranty_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch warranty templates: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        company_id: row.company_id,
        name: row.name,
        description: row.description,
        duration_days: row.duration_days,
        terms: row.terms,
        active: row.active,
        created_at: row.created_at,
        updated_at: row.updated_at
    }));
}

/**
 * Get warranty template by ID
 */
async function getById(id: string): Promise<WarrantyTemplate | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('warranty_templates')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch warranty template: ${error.message}`);
    }

    return {
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        description: data.description,
        duration_days: data.duration_days,
        terms: data.terms,
        active: data.active,
        created_at: data.created_at,
        updated_at: data.updated_at
    };
}

/**
 * Create a new warranty template
 */
async function create(input: WarrantyTemplateInput): Promise<WarrantyTemplate> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('warranty_templates')
        .insert({
            company_id: companyId,
            name: input.name,
            description: input.description,
            duration_days: input.duration_days,
            terms: input.terms,
            active: input.active ?? true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create warranty template: ${error.message}`);

    return {
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        description: data.description,
        duration_days: data.duration_days,
        terms: data.terms,
        active: data.active,
        created_at: data.created_at,
        updated_at: data.updated_at
    };
}

/**
 * Update warranty template
 */
async function update(id: string, input: WarrantyTemplateInput): Promise<WarrantyTemplate> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('warranty_templates')
        .update({
            name: input.name,
            description: input.description,
            duration_days: input.duration_days,
            terms: input.terms,
            active: input.active ?? true,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update warranty template: ${error.message}`);

    return {
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        description: data.description,
        duration_days: data.duration_days,
        terms: data.terms,
        active: data.active,
        created_at: data.created_at,
        updated_at: data.updated_at
    };
}

/**
 * Delete warranty template
 */
async function remove(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('warranty_templates')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete warranty template: ${error.message}`);
}

export const warrantyTemplateService = {
    list,
    getById,
    create,
    update,
    remove
};
