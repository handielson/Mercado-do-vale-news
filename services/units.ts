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
        condition: row.condition || 'new',
        status: row.status as UnitStatus,
        internal_notes: row.internal_notes,
        cost_price: row.cost_price ?? undefined,
        // Campos de rastreio de pedido (adicionados na migration 004)
        order_id: row.order_id ?? undefined,
        sale_id: row.sale_id ?? undefined,
        reserved_at: row.reserved_at ?? undefined,
        sold_at: row.sold_at ?? undefined,
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
    getStatsByProduct,

    /**
     * Busca unidade por IMEI 1, IMEI 2 ou serial.
     * Usado no PDV ao bipar o código do aparelho.
     */
    async searchByIdentifier(query: string): Promise<(Unit & { product_name?: string; product_sku?: string })[]> {
        const companyId = await getCompanyId();
        const trimmed = query.trim();

        const { data, error } = await supabase
            .from('units')
            .select('*, product:products(name, sku)')
            .eq('company_id', companyId)
            .or(`imei_1.eq.${trimmed},imei_2.eq.${trimmed},serial.eq.${trimmed}`);

        if (error) throw new Error(`Falha na busca: ${error.message}`);

        return (data || []).map((row: any) => ({
            ...transformFromDB(row),
            product_name: row.product?.name,
            product_sku: row.product?.sku,
        }));
    },

    /**
     * Auto-reserva a unidade disponível mais antiga (FIFO) para um produto.
     * Usado após confirmação de pagamento no e-commerce.
     */
    async autoReserve(productId: string, orderId?: string, saleId?: string): Promise<Unit> {
        const companyId = await getCompanyId();

        // Pega o mais antigo disponível (FIFO = created_at ASC)
        const { data: units, error: fetchError } = await supabase
            .from('units')
            .select('*')
            .eq('company_id', companyId)
            .eq('product_id', productId)
            .eq('status', UnitStatus.AVAILABLE)
            .order('created_at', { ascending: true })
            .limit(1);

        if (fetchError) throw new Error(`Falha ao buscar unidades: ${fetchError.message}`);
        if (!units || units.length === 0) {
            throw new Error(`Nenhuma unidade disponível para o produto ${productId}`);
        }

        const unit = units[0];

        const { data: updated, error: updateError } = await supabase
            .from('units')
            .update({
                status: UnitStatus.RESERVED,
                order_id: orderId || null,
                sale_id: saleId || null,
                reserved_at: new Date().toISOString(),
            })
            .eq('id', unit.id)
            .eq('status', UnitStatus.AVAILABLE) // garante sem race condition
            .select()
            .single();

        if (updateError || !updated) {
            throw new Error('Falha ao reservar unidade — tente novamente.');
        }

        return transformFromDB(updated);
    },

    /**
     * Troca a unidade reservada por outra disponível, registrando log de auditoria.
     * Só permitido enquanto a unidade atual está com status 'reserved'.
     */
    async swapUnit(opts: {
        currentUnitId: string;
        newUnitId: string;
        orderId?: string;
        saleId?: string;
        reason: string;
        swappedBy?: string;
    }): Promise<Unit> {
        const companyId = await getCompanyId();
        const { currentUnitId, newUnitId, orderId, saleId, reason, swappedBy } = opts;

        // Verifica status atual
        const { data: current, error: fetchErr } = await supabase
            .from('units')
            .select('*')
            .eq('id', currentUnitId)
            .eq('company_id', companyId)
            .single();

        if (fetchErr || !current) throw new Error('Unidade atual não encontrada.');
        if (current.status === UnitStatus.SOLD) {
            throw new Error('Não é possível trocar uma unidade já entregue (sold).');
        }

        // Libera unidade atual
        await supabase
            .from('units')
            .update({ status: UnitStatus.AVAILABLE, order_id: null, sale_id: null, reserved_at: null })
            .eq('id', currentUnitId);

        // Reserva nova unidade
        const { data: newUnit, error: newErr } = await supabase
            .from('units')
            .update({
                status: UnitStatus.RESERVED,
                order_id: orderId || null,
                sale_id: saleId || null,
                reserved_at: new Date().toISOString(),
            })
            .eq('id', newUnitId)
            .eq('status', UnitStatus.AVAILABLE)
            .select()
            .single();

        if (newErr || !newUnit) {
            // Rollback: devolver unidade original
            await supabase
                .from('units')
                .update({ status: UnitStatus.RESERVED, order_id: orderId || null, sale_id: saleId || null })
                .eq('id', currentUnitId);
            throw new Error('Falha ao reservar nova unidade. Operação revertida.');
        }

        // Registra log de auditoria
        await supabase.from('unit_swap_logs').insert({
            company_id: companyId,
            order_id: orderId || null,
            sale_id: saleId || null,
            old_unit_id: currentUnitId,
            new_unit_id: newUnitId,
            reason,
            swapped_by: swappedBy || 'admin',
        });

        return transformFromDB(newUnit);
    },

    /**
     * Marca unidade como sold (entregue). Ação irreversível.
     * Deve ser chamada ao confirmar entrega no painel admin.
     */
    async markAsSold(unitId: string, orderId?: string, saleId?: string): Promise<Unit> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('units')
            .update({
                status: UnitStatus.SOLD,
                order_id: orderId || null,
                sale_id: saleId || null,
                sold_at: new Date().toISOString(),
            })
            .eq('id', unitId)
            .eq('company_id', companyId)
            .neq('status', UnitStatus.SOLD) // não atualiza se já sold
            .select()
            .single();

        if (error || !data) throw new Error('Falha ao marcar como entregue.');

        return transformFromDB(data);
    },

    /**
     * Libera unidade reservada de volta para available.
     * Usado em cancelamentos de pedido/venda.
     */
    async release(unitId: string): Promise<Unit> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('units')
            .update({
                status: UnitStatus.AVAILABLE,
                order_id: null,
                sale_id: null,
                reserved_at: null,
            })
            .eq('id', unitId)
            .eq('company_id', companyId)
            .eq('status', UnitStatus.RESERVED) // só libera se estiver reserved
            .select()
            .single();

        if (error || !data) throw new Error('Falha ao liberar unidade.');

        return transformFromDB(data);
    },

    /**
     * Marca unidade como RMA (em processo de devolução).
     */
    async markAsRma(unitId: string): Promise<Unit> {
        const companyId = await getCompanyId();

        const { data, error } = await supabase
            .from('units')
            .update({ status: UnitStatus.RMA })
            .eq('id', unitId)
            .eq('company_id', companyId)
            .select()
            .single();

        if (error || !data) throw new Error('Falha ao marcar como RMA.');

        return transformFromDB(data);
    },

    /**
     * Busca histórico de trocas de uma unidade ou pedido.
     */
    async getSwapLogs(opts: { unitId?: string; orderId?: string }): Promise<any[]> {
        const companyId = await getCompanyId();

        let query = supabase
            .from('unit_swap_logs')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });

        if (opts.orderId) query = query.eq('order_id', opts.orderId);
        if (opts.unitId) {
            query = query.or(`old_unit_id.eq.${opts.unitId},new_unit_id.eq.${opts.unitId}`);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Falha ao buscar logs: ${error.message}`);

        return data || [];
    },

};


