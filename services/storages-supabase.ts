
import { supabase } from './supabase';

/**
 * STORAGE SERVICE - Supabase Implementation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Simple structure without multi-tenancy
 * - Manages storage capacities (64GB, 128GB, 256GB, etc.)
 */

export interface Storage {
    id: string;
    name: string;
    value_gb: number;
    display_order: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface StorageInput {
    name: string;
    value_gb: number;
    display_order?: number;
    active?: boolean;
}

/**
 * List all storages
 */
async function list(): Promise<Storage[]> {
    const { data, error } = await supabase
        .from('storages')
        .select('*')
        .eq('active', true)
        .order('display_order');

    if (error) throw new Error(`Failed to fetch storages: ${error.message}`);
    return data || [];
}

/**
 * Get storage by ID
 */
async function getById(id: string): Promise<Storage | null> {
    const { data, error } = await supabase
        .from('storages')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch storage: ${error.message}`);
    }

    return data;
}

/**
 * Create new storage
 */
async function create(input: StorageInput): Promise<Storage> {
    const { data, error } = await supabase
        .from('storages')
        .insert({
            name: input.name,
            value_gb: input.value_gb,
            display_order: input.display_order ?? 0,
            active: input.active ?? true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create storage: ${error.message}`);
    return data;
}

/**
 * Update existing storage
 */
async function update(id: string, input: StorageInput): Promise<Storage> {
    const { data, error } = await supabase
        .from('storages')
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

    if (error) throw new Error(`Failed to update storage: ${error.message}`);
    return data;
}

/**
 * Delete storage
 */
async function deleteStorage(id: string): Promise<void> {
    const { error } = await supabase
        .from('storages')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete storage: ${error.message}`);
}

/**
 * Get only active storages
 */
async function listActive(): Promise<Storage[]> {
    return list(); // Already filters by active
}

/**
 * Storage Service
 */
export const storageService = {
    list,
    getById,
    create,
    update,
    delete: deleteStorage,
    listActive
};
