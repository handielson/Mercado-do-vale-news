/**
 * Sale Service
 * Service for managing sales (PDV) in Supabase
 */

import { supabase } from './supabase';
import {
    Sale,
    SaleInput,
    SaleWithItems,
    SaleFilters,
    SaleSummary,
    SaleItem
} from '../types/sale';
import { calculateSaleTotals } from '../utils/saleCalculations';

/**
 * Create a new sale
 */
export const createSale = async (saleInput: SaleInput): Promise<Sale> => {
    try {
        // Calculate totals from items
        const totals = calculateSaleTotals(saleInput.items);

        // Prepare sale data
        const saleData = {
            customer_id: saleInput.customer_id,
            seller_id: saleInput.seller_id,
            subtotal: totals.subtotal,
            discount_total: totals.discount_total + (saleInput.delivery_cost_store || 0),
            total: totals.total + (saleInput.delivery_cost_customer || 0),
            cost_total: totals.cost_total,
            profit: totals.profit,
            payment_methods: saleInput.payment_methods,
            notes: saleInput.notes,
            status: 'completed' as const,

            // Delivery fields
            delivery_type: saleInput.delivery_type,
            delivery_person_id: saleInput.delivery_person_id,
            delivery_cost_store: saleInput.delivery_cost_store || 0,
            delivery_cost_customer: saleInput.delivery_cost_customer || 0,
            delivery_total: saleInput.delivery_total || 0
        };

        // Insert sale
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert(saleData)
            .select()
            .single();

        if (saleError) throw saleError;
        if (!sale) throw new Error('Failed to create sale');

        // Insert sale items
        const saleItems = saleInput.items.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            discount: item.discount,
            subtotal: item.subtotal,
            total: item.total,
            is_gift: item.is_gift
        }));

        const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems);

        if (itemsError) {
            // Rollback: delete sale if items insertion fails
            await supabase.from('sales').delete().eq('id', sale.id);
            throw itemsError;
        }

        // Create delivery credit if applicable
        if (saleInput.delivery_person_id && saleInput.delivery_total && saleInput.delivery_total > 0) {
            const deliveryCredit = {
                delivery_person_id: saleInput.delivery_person_id,
                sale_id: sale.id,
                amount: saleInput.delivery_total,
                delivery_type: saleInput.delivery_type!,
                status: 'pending' as const
            };

            const { error: creditError } = await supabase
                .from('delivery_credits')
                .insert(deliveryCredit);

            if (creditError) {
                console.error('Failed to create delivery credit:', creditError);
                // Don't rollback sale, just log the error
            }
        }

        return sale;
    } catch (error) {
        console.error('Error creating sale:', error);
        throw error;
    }
};

/**
 * Get sale by ID with items
 */
export const getSaleById = async (id: string): Promise<SaleWithItems | null> => {
    try {
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .select(`
                *,
                customer:customers(id, name, cpf_cnpj),
                seller:team_members(id, name)
            `)
            .eq('id', id)
            .single();

        if (saleError) throw saleError;
        if (!sale) return null;

        const { data: items, error: itemsError } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', id);

        if (itemsError) throw itemsError;

        return {
            ...sale,
            items: items || []
        };
    } catch (error) {
        console.error('Error fetching sale:', error);
        throw error;
    }
};

/**
 * Get sales with optional filters
 */
export const getSales = async (filters?: SaleFilters): Promise<SaleWithItems[]> => {
    try {
        let query = supabase
            .from('sales')
            .select(`
                *,
                customer:customers(id, name, cpf_cnpj),
                seller:team_members(id, name)
            `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters?.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters?.seller_id) {
            query = query.eq('seller_id', filters.seller_id);
        }
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.start_date) {
            query = query.gte('created_at', filters.start_date);
        }
        if (filters?.end_date) {
            query = query.lte('created_at', filters.end_date);
        }
        if (filters?.min_total) {
            query = query.gte('total', filters.min_total);
        }
        if (filters?.max_total) {
            query = query.lte('total', filters.max_total);
        }

        const { data: sales, error: salesError } = await query;

        if (salesError) throw salesError;
        if (!sales) return [];

        // Fetch items for each sale
        const salesWithItems = await Promise.all(
            sales.map(async (sale) => {
                const { data: items } = await supabase
                    .from('sale_items')
                    .select('*')
                    .eq('sale_id', sale.id);

                return {
                    ...sale,
                    items: items || []
                };
            })
        );

        return salesWithItems;
    } catch (error) {
        console.error('Error fetching sales:', error);
        throw error;
    }
};

/**
 * Cancel a sale
 */
export const cancelSale = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('sales')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) throw error;

        // Cancel associated delivery credits
        await supabase
            .from('delivery_credits')
            .update({ status: 'cancelled' })
            .eq('sale_id', id);
    } catch (error) {
        console.error('Error cancelling sale:', error);
        throw error;
    }
};

/**
 * Refund a sale
 */
export const refundSale = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('sales')
            .update({ status: 'refunded' })
            .eq('id', id);

        if (error) throw error;

        // Cancel associated delivery credits
        await supabase
            .from('delivery_credits')
            .update({ status: 'cancelled' })
            .eq('sale_id', id);
    } catch (error) {
        console.error('Error refunding sale:', error);
        throw error;
    }
};

/**
 * Get sales summary
 */
export const getSalesSummary = async (filters?: SaleFilters): Promise<SaleSummary> => {
    try {
        let query = supabase
            .from('sales')
            .select('total, profit, cost_total')
            .eq('status', 'completed');

        // Apply filters
        if (filters?.customer_id) {
            query = query.eq('customer_id', filters.customer_id);
        }
        if (filters?.seller_id) {
            query = query.eq('seller_id', filters.seller_id);
        }
        if (filters?.start_date) {
            query = query.gte('created_at', filters.start_date);
        }
        if (filters?.end_date) {
            query = query.lte('created_at', filters.end_date);
        }

        const { data: sales, error } = await query;

        if (error) throw error;
        if (!sales || sales.length === 0) {
            return {
                total_sales: 0,
                total_revenue: 0,
                total_profit: 0,
                total_cost: 0,
                average_ticket: 0,
                profit_margin: 0
            };
        }

        const total_sales = sales.length;
        const total_revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const total_profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
        const total_cost = sales.reduce((sum, sale) => sum + sale.cost_total, 0);
        const average_ticket = total_revenue / total_sales;
        const profit_margin = total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0;

        return {
            total_sales,
            total_revenue,
            total_profit,
            total_cost,
            average_ticket,
            profit_margin
        };
    } catch (error) {
        console.error('Error fetching sales summary:', error);
        throw error;
    }
};
