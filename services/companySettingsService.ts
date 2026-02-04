import { supabase } from './supabase';
import { CompanySettings, CompanySettingsInput } from '../types/companySettings';

/**
 * Company Settings Service
 * Manages company information for receipts and documents
 */

export const companySettingsService = {
    /**
     * Get company settings
     * Returns the first (and should be only) company settings record
     */
    async get(): Promise<CompanySettings | null> {
        try {
            const { data, error } = await supabase
                .from('company_settings')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                // If no settings exist yet, return null
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching company settings:', error);
            throw error;
        }
    },

    /**
     * Update company settings
     * If no settings exist, creates a new record
     */
    async update(settings: CompanySettingsInput): Promise<CompanySettings> {
        try {
            // First, check if settings exist
            const existing = await this.get();

            if (existing) {
                // Update existing settings
                const { data, error } = await supabase
                    .from('company_settings')
                    .update(settings)
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // Create new settings
                const { data, error } = await supabase
                    .from('company_settings')
                    .insert(settings)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        } catch (error) {
            console.error('Error updating company settings:', error);
            throw error;
        }
    },

    /**
     * Get default settings (fallback)
     */
    getDefaults(): Partial<CompanySettings> {
        return {
            company_name: 'Mercado do Vale',
            address: '',
            phone: '',
            cnpj: '',
            email: '',
            header_text: 'Bem-vindo!',
            footer_text: 'Obrigado pela preferência! Volte sempre!',
            receipt_width: '80mm',
            show_company_info: true,
            show_order_number: true,
            show_timestamp: true,
            show_seller_info: true
        };
    }
};
