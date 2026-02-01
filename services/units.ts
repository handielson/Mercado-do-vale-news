import { Unit, UnitInput } from '../types/unit';
import { UnitStatus } from '../utils/field-standards';
import { supabase } from './supabase';

/**
 * UNIT SERVICE - Supabase Implementation
 * Multi-tenant service for inventory unit management
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
 * List units by product
 */
async function listByProduct(productId: string): Promise<Unit[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('company_id', companyId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch units: ${error.message}`);

    return (data || []).map(transformFromDB);
}

/**
 * Get unit by ID
 */
async function getById(id: string): Promise<Unit> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('Unidade não encontrada');
        throw new Error(`Failed to fetch unit: ${error.message}`);
    }

    return transformFromDB(data);
}

/**
 * Create new unit
 */
async function create(input: UnitInput): Promise<Unit> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('units')
        .insert({
            company_id: companyId,
            product_id: input.product_id,
            imei_1: input.imei_1 || null,
            imei_2: input.imei_2 || null,
            serial: input.serial_number || null,
            status: input.status || UnitStatus.AVAILABLE,
            internal_notes: input.internal_notes || null
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create unit: ${error.message}`);

    return transformFromDB(data);
}

/**
 * Update unit status
 */
async function updateStatus(id: string, status: UnitStatus): Promise<Unit> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('units')
        .update({ status })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update unit status: ${error.message}`);

    return transformFromDB(data);
}

/**
 * Delete unit
 */
async function deleteUnit(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete unit: ${error.message}`);
}

/**
 * Get unit statistics by product
 */
async function getStatsByProduct(productId: string): Promise<{
    total: number;
    available: number;
    reserved: number;
    sold: number;
    rma: number;
}> {
    const units = await listByProduct(productId);

    return {
        total: units.length,
        available: units.filter(u => u.status === UnitStatus.AVAILABLE).length,
        reserved: units.filter(u => u.status === UnitStatus.RESERVED).length,
        sold: units.filter(u => u.status === UnitStatus.SOLD).length,
        rma: units.filter(u => u.status === UnitStatus.RMA).length
    };
}

/**
 * Transform database row to Unit type
 */
function transformFromDB(row: any): Unit {
    return {
        id: row.id,
        product_id: row.product_id,
        imei_1: row.imei_1,
        imei_2: row.imei_2,
        serial_number: row.serial,
        status: row.status as UnitStatus,
        internal_notes: row.internal_notes,
        cost_price: null, // Not in current schema
        created: row.created_at,
        updated: row.updated_at
    };
}

export const unitService = {
    listByProduct,
    getById,
    create,
    updateStatus,
    delete: deleteUnit,
    getStatsByProduct
};
