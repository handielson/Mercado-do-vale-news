import { supabase } from './supabase';
import type { PaymentIntegration, PaymentIntegrationInput, PaymentGatewayName } from '../types/paymentIntegration';

// Cache global de companyId em ./companyContext (lê VITE_COMPANY_ID, fallback Supabase).
import { getCompanyId } from './companyContext';

export const paymentIntegrationService = {
    async getIntegrations(): Promise<PaymentIntegration[]> {
        const companyId = await getCompanyId();
        const { data, error } = await supabase
            .from('payment_integrations')
            .select('*')
            .eq('company_id', companyId)
            .order('gateway_name', { ascending: true });

        if (error) throw new Error(error.message);
        return data || [];
    },

    async getIntegrationByGateway(gatewayName: PaymentGatewayName): Promise<PaymentIntegration | null> {
        const companyId = await getCompanyId();
        const { data, error } = await supabase
            .from('payment_integrations')
            .select('*')
            .eq('company_id', companyId)
            .eq('gateway_name', gatewayName)
            .single();

        if (error && error.code !== 'PGRST116') throw new Error(error.message);
        return data as PaymentIntegration | null;
    },

    async upsertIntegration(input: PaymentIntegrationInput): Promise<PaymentIntegration> {
        const companyId = await getCompanyId();

        // Check if exists
        const { data: existing } = await supabase
            .from('payment_integrations')
            .select('id')
            .eq('company_id', companyId)
            .eq('gateway_name', input.gateway_name)
            .single();

        const rowData = {
            company_id: companyId,
            gateway_name: input.gateway_name,
            is_active: input.is_active,
            public_key: input.public_key,
            access_token: input.access_token,
            client_id: input.client_id,
            client_secret: input.client_secret,
            environment: input.environment,
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            result = await supabase
                .from('payment_integrations')
                .update(rowData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('payment_integrations')
                .insert([rowData])
                .select()
                .single();
        }

        if (result.error) throw new Error(result.error.message);
        return result.data as PaymentIntegration;
    },

    async deleteIntegration(id: string): Promise<void> {
        const { error } = await supabase
            .from('payment_integrations')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }
};
