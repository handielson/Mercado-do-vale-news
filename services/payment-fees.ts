import { supabase } from './supabase';
import { PaymentFee, PaymentFeeInput } from '../types/payment-fees';

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

export const paymentFeesService = {
    async list(): Promise<PaymentFee[]> {
        const { data, error } = await supabase
            .from('payment_fees')
            .select('*')
            .order('payment_method', { ascending: true })
            .order('installments', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async update(id: string, input: PaymentFeeInput): Promise<void> {
        const { error } = await supabase
            .from('payment_fees')
            .update({
                operator_name: input.operator_name,
                operator_fee: input.operator_fee,
                applied_fee: input.applied_fee,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
    },

    async initializeDefaults(): Promise<void> {
        // Check if already initialized
        const { count } = await supabase
            .from('payment_fees')
            .select('*', { count: 'exact', head: true });

        if (count && count > 0) return; // Already initialized

        const companyId = await getCompanyId();

        // Default fees based on the provided image
        const defaults: Omit<PaymentFee, 'id' | 'created_at' | 'updated_at'>[] = [
            { company_id: companyId, payment_method: 'debit', installments: 1, operator_fee: 1, applied_fee: 1 },
            { company_id: companyId, payment_method: 'pix', installments: 1, operator_fee: 0, applied_fee: 0 },
            ...Array.from({ length: 18 }, (_, i) => ({
                company_id: companyId,
                payment_method: 'credit' as const,
                installments: i + 1,
                operator_fee: getDefaultOperatorFee(i + 1),
                applied_fee: getDefaultAppliedFee(i + 1)
            }))
        ];

        const { error } = await supabase.from('payment_fees').insert(defaults);
        if (error) throw error;
    }
};

function getDefaultOperatorFee(installments: number): number {
    const fees = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    return fees[installments - 1] || 5;
}

function getDefaultAppliedFee(installments: number): number {
    const fees = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    return fees[installments - 1] || 7;
}
