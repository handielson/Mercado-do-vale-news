import { supabase } from './supabase';
import type {
    TypeUpgradeRequest,
    TypeUpgradeRequestWithCustomer,
    CreateTypeUpgradeRequest,
    UpdateTypeUpgradeRequest,
    RequestedCustomerType
} from '../types/typeUpgradeRequest';

/**
 * Type Upgrade Request Service
 * 
 * Manages customer type upgrade requests
 * ANTIGRAVITY PROTOCOL: Keep under 300 lines
 */

/**
 * Create a new type upgrade request
 */
export const createUpgradeRequest = async (
    customerId: string,
    requestedType: RequestedCustomerType
): Promise<TypeUpgradeRequest> => {
    // Check if there's already a pending request
    const { data: existing } = await supabase
        .from('customer_type_requests')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'pending')
        .single();

    if (existing) {
        throw new Error('Você já possui uma solicitação pendente');
    }

    const { data, error } = await supabase
        .from('customer_type_requests')
        .insert({
            customer_id: customerId,
            requested_type: requestedType
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Get current upgrade request status for a customer
 */
export const getCustomerUpgradeRequest = async (
    customerId: string
): Promise<TypeUpgradeRequest | null> => {
    const { data, error } = await supabase
        .from('customer_type_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
};

/**
 * Get all upgrade requests (admin only)
 */
export const getAllUpgradeRequests = async (
    status?: 'pending' | 'approved' | 'rejected'
): Promise<TypeUpgradeRequestWithCustomer[]> => {
    let query = supabase
        .from('customer_type_requests')
        .select(`
            *,
            customer:customers (
                id,
                name,
                email,
                cpf_cnpj,
                phone
            )
        `)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as TypeUpgradeRequestWithCustomer[];
};

/**
 * Approve upgrade request (admin only)
 */
export const approveUpgradeRequest = async (
    requestId: string,
    reviewerId: string
): Promise<void> => {
    // Get the request
    const { data: request, error: fetchError } = await supabase
        .from('customer_type_requests')
        .select('*, customer:customers(id, customer_type)')
        .eq('id', requestId)
        .single();

    if (fetchError) throw fetchError;
    if (!request) throw new Error('Solicitação não encontrada');

    // Update customer type
    const { error: updateCustomerError } = await supabase
        .from('customers')
        .update({ customer_type: request.requested_type })
        .eq('id', request.customer_id);

    if (updateCustomerError) throw updateCustomerError;

    // Update request status
    const { error: updateRequestError } = await supabase
        .from('customer_type_requests')
        .update({
            status: 'approved',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

    if (updateRequestError) throw updateRequestError;
};

/**
 * Reject upgrade request (admin only)
 */
export const rejectUpgradeRequest = async (
    requestId: string,
    reviewerId: string,
    reason?: string
): Promise<void> => {
    const { error } = await supabase
        .from('customer_type_requests')
        .update({
            status: 'rejected',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason || null
        })
        .eq('id', requestId);

    if (error) throw error;
};

/**
 * Get upgrade request statistics (admin only)
 */
export const getUpgradeRequestStats = async (): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
}> => {
    const { data, error } = await supabase
        .from('customer_type_requests')
        .select('status');

    if (error) throw error;

    const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: data.length
    };

    data.forEach(req => {
        if (req.status === 'pending') stats.pending++;
        if (req.status === 'approved') stats.approved++;
        if (req.status === 'rejected') stats.rejected++;
    });

    return stats;
};
