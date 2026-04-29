import { Unit, UnitInput } from '../types/unit';
import { UnitStatus } from '../utils/field-standards';
import { supabase } from './supabase';
import { vpsApiService } from './vpsApiService';

/**
 * UNIT SERVICE — VPS MySQL (fonte de verdade para o inventário serializado).
 *
 * Triggers no MySQL mantêm `products.stock_quantity = COUNT(units WHERE status='available')`.
 *
 * Tabelas de auditoria (unit_swap_logs, rma_logs) seguem no Supabase por enquanto.
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
        order_id: row.order_id ?? undefined,
        sale_id: row.sale_id ?? undefined,
        reserved_at: row.reserved_at ?? undefined,
        sold_at: row.sold_at ?? undefined,
        created: row.created_at,
        updated: row.updated_at,
    };
}

function toPayload(input: Partial<UnitInput>): any {
    const out: any = {};
    if (input.product_id !== undefined) out.product_id = input.product_id;
    if (input.imei_1 !== undefined) out.imei_1 = input.imei_1 || null;
    if (input.imei_2 !== undefined) out.imei_2 = input.imei_2 || null;
    if (input.serial_number !== undefined) out.serial = input.serial_number || null;
    if (input.condition !== undefined) out.condition = input.condition;
    if (input.status !== undefined) out.status = input.status;
    if (input.cost_price !== undefined) out.cost_price = input.cost_price;
    if (input.internal_notes !== undefined) out.internal_notes = input.internal_notes || null;
    return out;
}

async function listByProduct(productId: string): Promise<Unit[]> {
    const data = await vpsApiService.getUnitsByProduct(productId);
    return (data || []).map(transformFromDB);
}

async function create(input: UnitInput): Promise<Unit> {
    const data = await vpsApiService.createUnit(toPayload(input));
    if (!data) throw new Error('Failed to create unit');
    return transformFromDB(data);
}

async function updateStatus(id: string, status: UnitStatus): Promise<Unit> {
    const data = await vpsApiService.updateUnit(id, { status });
    if (!data) throw new Error('Failed to update unit status');
    return transformFromDB(data);
}

async function deleteUnit(id: string): Promise<void> {
    const ok = await vpsApiService.deleteUnit(id);
    if (!ok) throw new Error('Failed to delete unit');
}

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
        rma: units.filter(u => u.status === UnitStatus.RMA).length,
    };
}

export const unitService = {
    listByProduct,
    create,
    updateStatus,
    delete: deleteUnit,
    getStatsByProduct,

    /**
     * Busca unidade por IMEI 1, IMEI 2 ou serial (PDV).
     */
    async searchByIdentifier(query: string): Promise<(Unit & { product_name?: string; product_sku?: string })[]> {
        const data = await vpsApiService.getUnitByIdentifier(query.trim());
        return (data || []).map((row: any) => ({
            ...transformFromDB(row),
            product_name: row.product_name,
            product_sku: row.product_sku,
        }));
    },

    /**
     * Auto-reserva a unidade disponível mais antiga (FIFO) para um produto.
     * Race-condition: o PUT /units/:id sem checagem de status pode reservar uma unidade
     * já tomada por outro processo. Para o volume atual está OK; refinar com endpoint
     * atômico (`/units/auto-reserve`) se virar gargalo.
     */
    async autoReserve(productId: string, orderId?: string, saleId?: string): Promise<Unit> {
        const available = await vpsApiService.getUnitsByProduct(productId, 'available');
        if (!available || available.length === 0) {
            throw new Error(`Nenhuma unidade disponível para o produto ${productId}`);
        }
        // FIFO: o endpoint já retorna ordenado por created_at ASC
        const unit = available[0];
        const updated = await vpsApiService.updateUnit(unit.id, {
            status: UnitStatus.RESERVED,
            order_id: orderId || null,
            sale_id: saleId || null,
            reserved_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        if (!updated) throw new Error('Falha ao reservar unidade — tente novamente.');
        return transformFromDB(updated);
    },

    /**
     * Troca a unidade reservada por outra disponível, registrando log no Supabase.
     */
    async swapUnit(opts: {
        currentUnitId: string;
        newUnitId: string;
        orderId?: string;
        saleId?: string;
        reason: string;
        swappedBy?: string;
    }): Promise<Unit> {
        const { currentUnitId, newUnitId, orderId, saleId, reason, swappedBy } = opts;

        // Libera atual
        const released = await vpsApiService.updateUnit(currentUnitId, {
            status: UnitStatus.AVAILABLE,
            order_id: null,
            sale_id: null,
            reserved_at: null,
        });
        if (!released) throw new Error('Falha ao liberar unidade atual.');

        // Reserva nova
        const newUnit = await vpsApiService.updateUnit(newUnitId, {
            status: UnitStatus.RESERVED,
            order_id: orderId || null,
            sale_id: saleId || null,
            reserved_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        if (!newUnit) {
            // Rollback
            await vpsApiService.updateUnit(currentUnitId, {
                status: UnitStatus.RESERVED,
                order_id: orderId || null,
                sale_id: saleId || null,
            });
            throw new Error('Falha ao reservar nova unidade. Operação revertida.');
        }

        // Audit log no Supabase (tabela ainda não migrada)
        const { data: company } = await supabase.from('companies').select('id').eq('slug', 'mercado-do-vale').single();
        await supabase.from('unit_swap_logs').insert({
            company_id: company?.id,
            order_id: orderId || null,
            sale_id: saleId || null,
            old_unit_id: currentUnitId,
            new_unit_id: newUnitId,
            reason,
            swapped_by: swappedBy || 'admin',
        });

        return transformFromDB(newUnit);
    },

    async markAsSold(unitId: string, orderId?: string, saleId?: string): Promise<Unit> {
        const data = await vpsApiService.updateUnit(unitId, {
            status: UnitStatus.SOLD,
            order_id: orderId || null,
            sale_id: saleId || null,
            sold_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        if (!data) throw new Error('Falha ao marcar como entregue.');
        return transformFromDB(data);
    },

    async release(unitId: string): Promise<Unit> {
        const data = await vpsApiService.updateUnit(unitId, {
            status: UnitStatus.AVAILABLE,
            order_id: null,
            sale_id: null,
            reserved_at: null,
        });
        if (!data) throw new Error('Falha ao liberar unidade.');
        return transformFromDB(data);
    },

    async markAsRma(unitId: string): Promise<Unit> {
        const data = await vpsApiService.updateUnit(unitId, { status: UnitStatus.RMA });
        if (!data) throw new Error('Falha ao marcar como RMA.');
        return transformFromDB(data);
    },

    async getSwapLogs(opts: { unitId?: string; orderId?: string }): Promise<any[]> {
        const { data: company } = await supabase.from('companies').select('id').eq('slug', 'mercado-do-vale').single();
        let query = supabase
            .from('unit_swap_logs')
            .select('*')
            .eq('company_id', company?.id)
            .order('created_at', { ascending: true });
        if (opts.orderId) query = query.eq('order_id', opts.orderId);
        if (opts.unitId) query = query.or(`old_unit_id.eq.${opts.unitId},new_unit_id.eq.${opts.unitId}`);
        const { data, error } = await query;
        if (error) throw new Error(`Falha ao buscar logs: ${error.message}`);
        return data || [];
    },
};
