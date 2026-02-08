
import { Color, ColorInput } from '../types/color';
import { supabase } from './supabase';

/**
 * COLOR SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Multi-tenant with company_id isolation
 * - Follows same pattern as brandService
 * - Includes hex_code mapping for visual preview
 */

// TEMPORARY: Hardcoded company_id until we implement auth
const TEMP_COMPANY_ID = 'mercado-do-vale';

// Color mapping for visual preview (fallback if hex_code not in DB)
export const COLOR_MAP: Record<string, string> = {
    'Preto': '#000000',
    'Branco': '#FFFFFF',
    'Azul': '#3B82F6',
    'Verde': '#10B981',
    'Vermelho': '#EF4444',
    'Rosa': '#EC4899',
    'Dourado': '#F59E0B',
    'Prata': '#9CA3AF',
    'Cinza': '#6B7280',
    'Roxo': '#8B5CF6',
    'Amarelo': '#EAB308',
    'Laranja': '#F97316'
};

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
 * Generate URL-friendly slug from color name
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
 * List all colors
 */
async function list(): Promise<Color[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch colors: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        hex_code: row.hex_code,
        active: row.active ?? true,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get color by ID
 */
async function getById(id: string): Promise<Color | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch color: ${error.message}`);
    }

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active ?? true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Create new color
 */
async function create(input: ColorInput): Promise<Color> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    // Auto-detect hex_code from COLOR_MAP if not provided
    const hex_code = input.hex_code || COLOR_MAP[input.name] || '#000000';

    const { data, error } = await supabase
        .from('colors')
        .insert({
            company_id: companyId,
            name: input.name,
            slug,
            hex_code,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create color: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing color
 */
async function update(id: string, input: ColorInput): Promise<Color> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('colors')
        .update({
            name: input.name,
            slug,
            hex_code: input.hex_code !== undefined ? input.hex_code : undefined,
            active: input.active !== undefined ? input.active : undefined
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update color: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Delete color
 */
async function deleteColor(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete color: ${error.message}`);
}

/**
 * Get only active colors
 */
async function listActive(): Promise<Color[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

    if (error) throw new Error(`Failed to fetch active colors: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        hex_code: row.hex_code,
        active: row.active,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get color hex code (from entity or COLOR_MAP)
 */
function getColorHex(colorName: string): string | undefined {
    // This is a synchronous helper, so we can't query DB
    // It's used for preview only, fallback to COLOR_MAP
    return COLOR_MAP[colorName];
}

export const colorService = {
    list,
    getById,
    create,
    update,
    delete: deleteColor,
    listActive,
    getColorHex
};
