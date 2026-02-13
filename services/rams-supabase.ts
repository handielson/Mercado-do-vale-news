
import { supabase } from './supabase';

/**
 * RAM SERVICE - Supabase Implementation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Simple structure without multi-tenancy
 * - Manages RAM memory capacities (2GB, 4GB, 8GB, etc.)
 */

export interface Ram {
    id: string;
    name: string;
    value_gb: number;
    display_order: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface RamInput {
    name: string;
    value_gb: number;
    display_order?: number;
    active?: boolean;
}

/**
 * List all RAMs
 */
async function list(): Promise<Ram[]> {
    const { data, error } = await supabase
        .from('rams')
        .select('*')
        .eq('active', true)
        .order('display_order');

    if (error) throw new Error(`Failed to fetch RAMs: ${error.message}`);
    return data || [];
}

/**
 * Get RAM by ID
 */
async function getById(id: string): Promise<Ram | null> {
    const { data, error } = await supabase
        .from('rams')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch RAM: ${error.message}`);
    }

    return data;
}

/**
 * Create new RAM
 */
async function create(input: RamInput): Promise<Ram> {
    const { data, error } = await supabase
        .from('rams')
        .insert({
            name: input.name,
            value_gb: input.value_gb,
            display_order: input.display_order ?? 0,
            active: input.active ?? true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create RAM: ${error.message}`);
    return data;
}

/**
 * Update existing RAM
 */
async function update(id: string, input: RamInput): Promise<Ram> {
    const { data, error } = await supabase
        .from('rams')
        .update({
            name: input.name,
            value_gb: input.value_gb,
            display_order: input.display_order,
            active: input.active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(`Failed to update RAM: ${error.message}`);
    return data;
}

/**
 * Delete RAM
 */
async function deleteRam(id: string): Promise<void> {
    const { error } = await supabase
        .from('rams')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete RAM: ${error.message}`);
}

/**
 * Get only active RAMs
 */
async function listActive(): Promise<Ram[]> {
    return list(); // Already filters by active
}

/**
 * RAM Service
 */
export const ramService = {
    list,
    getById,
    create,
    update,
    delete: deleteRam,
    listActive
};
