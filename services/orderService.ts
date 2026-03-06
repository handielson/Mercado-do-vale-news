/**
 * Order Service — Pedidos Online (E-commerce)
 * Separado do saleService (PDV). Gerencia o ciclo de vida dos pedidos online.
 */

import { supabase } from './supabase';
import type {
    Order,
    OrderInput,
    OrderWithItems,
    OrderFilters,
    OrderStatus,
    OrderPaymentStatus,
    GatewayPaymentResult,
} from '../types/order';

const COMPANY_SLUG = 'mercado-do-vale';

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();
    if (error || !data) throw new Error('Empresa não encontrada.');
    return data.id;
}

// ─── Criar pedido ─────────────────────────────────────────────────────────────

export async function createOrder(input: OrderInput): Promise<Order> {
    const companyId = await getCompanyId();

    const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = input.coupon_discount ?? 0;
    const total = subtotal - discount + input.shipping_cost;

    const orderData = {
        company_id: companyId,
        customer_id: input.customer_id ?? null,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email ?? null,
        status: 'pending' as OrderStatus,
        payment_status: 'pending' as OrderPaymentStatus,
        payment_method: input.payment_method,
        payment_gateway: input.payment_gateway ?? null,
        delivery_type: input.delivery_type,
        shipping_address: input.shipping_address ?? null,
        shipping_cost: input.shipping_cost,
        subtotal,
        discount,
        total,
        coupon_code: input.coupon_code ?? null,
        coupon_discount: input.coupon_discount ?? 0,
        notes: input.notes ?? null,
    };

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error('Falha ao criar pedido.');

    // Insere os itens
    const items = input.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items);

    if (itemsError) {
        // Rollback: remove o pedido se os itens falharem
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(itemsError.message);
    }

    return order as Order;
}

// ─── Buscar pedido por ID ─────────────────────────────────────────────────────

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !order) return null;

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id);

    return { ...order, items: items || [] } as OrderWithItems;
}

// ─── Listar pedidos (painel admin) ────────────────────────────────────────────

export async function getOrders(filters?: OrderFilters): Promise<OrderWithItems[]> {
    let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.payment_status) query = query.eq('payment_status', filters.payment_status);
    if (filters?.payment_method) query = query.eq('payment_method', filters.payment_method);
    if (filters?.delivery_type) query = query.eq('delivery_type', filters.delivery_type);
    if (filters?.start_date) query = query.gte('created_at', filters.start_date);
    if (filters?.end_date) query = query.lte('created_at', filters.end_date);
    if (filters?.search) {
        query = query.or(
            `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`
        );
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);
    if (!orders?.length) return [];

    // Busca itens de todos os pedidos em paralelo
    const withItems = await Promise.all(
        orders.map(async (order) => {
            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id);
            return { ...order, items: items || [] } as OrderWithItems;
        })
    );

    return withItems;
}

// ─── Atualizar status (admin) ─────────────────────────────────────────────────

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
    if (error) throw new Error(error.message);
}

// ─── Confirmar pagamento (via webhook do gateway) ─────────────────────────────

export async function confirmPayment(
    gatewayPaymentId: string,
    result: Partial<GatewayPaymentResult>
): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, items:order_items(product_id, quantity)')
        .eq('gateway_payment_id', gatewayPaymentId)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado para este pagamento.');

    // Atualiza status do pedido
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_status: 'paid' })
        .eq('id', order.id);

    if (updateError) throw new Error(updateError.message);

    // Deduz estoque dos itens
    const items = (order as any).items || [];
    for (const item of items) {
        if (!item.product_id) continue;
        const { error: stockError } = await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
        });
        if (stockError) {
            console.error(`[orderService] Falha ao deduzir estoque do produto ${item.product_id}:`, stockError);
        }
    }
}

// ─── Finalizar pedido com pagamento na entrega (admin) ───────────────────────

export async function completeOnDeliveryOrder(id: string): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, items:order_items(product_id, quantity)')
        .eq('id', id)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado.');

    // Atualiza status
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed', payment_status: 'paid' })
        .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    // Deduz estoque
    const items = (order as any).items || [];
    for (const item of items) {
        if (!item.product_id) continue;
        const { error: stockError } = await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
        });
        if (stockError) {
            console.error(`[orderService] Falha ao deduzir estoque:`, stockError);
        }
    }
}

// ─── Cancelar pedido ──────────────────────────────────────────────────────────

export async function cancelOrder(id: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id);
    if (error) throw new Error(error.message);
}

// ─── Salvar resultado do gateway no pedido ────────────────────────────────────

export async function saveGatewayResult(orderId: string, result: GatewayPaymentResult): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({
            gateway_payment_id: result.gateway_payment_id,
            gateway_payment_url: result.payment_url ?? null,
            status: 'awaiting_payment',
            payment_status: result.status,
        })
        .eq('id', orderId);
    if (error) throw new Error(error.message);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const orderService = {
    createOrder,
    getOrderById,
    getOrders,
    updateOrderStatus,
    confirmPayment,
    completeOnDeliveryOrder,
    cancelOrder,
    saveGatewayResult,
};
