
import { supabase } from './supabase';

/**
 * BATTERY HEALTH SERVICE - Supabase Implementation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Simple structure without multi-tenancy
 * - Manages battery health percentages (100%, 95%, 90%, etc.)
 */

export interface BatteryHealth {
    id: string;
    name: string;
    percentage: number;
    display_order: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface BatteryHealthInput {
    name: string;
    percentage: number;
    display_order?: number;
    active?: boolean;
}

/**
 * List all battery healths
 */
async function list(): Promise<BatteryHealth[]> {
    const { data, error } = await supabase
        .from('battery_healths')
        .select('*')
        .eq('active', true)
        .order('display_order');

    if (error) throw new Error(`Failed to fetch battery healths: ${error.message}`);
    return data || [];
}

/**
 * Get battery health by ID
 */
async function getById(id: string): Promise<BatteryHealth | null> {
    const { data, error } = await supabase
        .from('battery_healths')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch battery health: ${error.message}`);
    }

    return data;
}

/**
 * Create new battery health
 */
async function create(input: BatteryHealthInput): Promise<BatteryHealth> {
    const { data, error } = await supabase
        .from('battery_healths')
        .insert({
            name: input.name,
            percentage: input.percentage,
            display_order: input.display_order ?? 0,
            active: input.active ?? true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create battery health: ${error.message}`);
    return data;
}

/**
 * Update existing battery health
 */
async function update(id: string, input: BatteryHealthInput): Promise<BatteryHealth> {
    const { data, error } = await supabase
        .from('battery_healths')
        .update({
            name: input.name,
            percentage: input.percentage,
            display_order: input.display_order,
            active: input.active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(`Failed to update battery health: ${error.message}`);
    return data;
}

/**
 * Delete battery health
 */
async function deleteBatteryHealth(id: string): Promise<void> {
    const { error } = await supabase
        .from('battery_healths')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete battery health: ${error.message}`);
}

/**
 * Get only active battery healths
 */
async function listActive(): Promise<BatteryHealth[]> {
    return list(); // Already filters by active
}

/**
 * Battery Health Service
 */
export const batteryHealthService = {
    list,
    getById,
    create,
    update,
    delete: deleteBatteryHealth,
    listActive
};
