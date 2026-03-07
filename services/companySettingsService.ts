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

            if (data) {
                // Synthesize address if it's missing but individual fields exist
                if (!data.address && data.address_street) {
                    const parts = [];
                    parts.push(`${data.address_street}, ${data.address_number || 'S/N'}`);
                    if (data.address_complement) parts.push(data.address_complement);
                    if (data.address_neighborhood) parts.push(data.address_neighborhood);

                    const cityState = [];
                    if (data.address_city) cityState.push(data.address_city);
                    if (data.address_state) cityState.push(data.address_state);
                    if (cityState.length > 0) parts.push(cityState.join(' - '));

                    if (data.address_zip_code) parts.push(`CEP: ${data.address_zip_code}`);

                    data.address = parts.filter(Boolean).join(' - ');
                }
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
            show_seller_info: true,
            show_seller_info: true,
            receipt_show_extra_page: false,
            payment_receipt_template: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.5;">
    <!-- CABEÇALHO -->
    <div style="border: 2px solid #84cc16; padding: 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div style="width: 150px; text-align: center;">
            {{logo}}
        </div>
        <div style="text-align: right; flex: 1;">
            <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: normal; text-transform: uppercase;">RECIBO</h1>
            <p style="margin: 0; font-weight: bold; font-size: 14px;">{{nome_loja}}</p>
            <p style="margin: 0; font-size: 12px; color: #555;">{{cnpj}}</p>
            <p style="margin: 0; font-size: 12px; color: #555;">{{endereco}}</p>
            <p style="margin: 0; font-size: 12px; color: #555;">{{telefone}} | {{email}}</p>
            <p style="margin: 8px 0 0 0; font-weight: bold; font-size: 14px; color: #2563eb;">Nº: {{numero_recibo}}</p>
        </div>
    </div>

    <!-- CORPO -->
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">
        <h2 style="margin: 0; font-size: 14px; font-weight: bold; color: #374151; display: inline-block; width: 50%;">DADOS DA TRANSAÇÃO</h2>
        <h2 style="margin: 0; font-size: 14px; font-weight: bold; color: #374151; display: inline-block; width: 49%; text-align: right;">VALOR</h2>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
        <div>
            <p style="margin: 0 0 4px 0; font-size: 13px;"><strong>Nome:</strong> {{nome_cliente}}</p>
            <p style="margin: 0 0 4px 0; font-size: 13px;"><strong>Documento:</strong> {{cpf_cliente}}</p>
            <p style="margin: 0 0 4px 0; font-size: 13px;"><strong>Data Emissão:</strong> {{data_emissao}}</p>
        </div>
        <div style="text-align: right;">
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #16a34a;">{{valor}}</p>
        </div>
    </div>

    <!-- DECLARAÇÃO -->
    <div style="background-color: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 40px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">
            {{texto_abertura}} a quantia de <strong>{{valor}}</strong> referente a <strong>{{historico}}</strong>.
        </p>
    </div>

    <!-- ASSINATURA -->
    <div style="margin-top: 60px; text-align: center;">
        <div style="width: 300px; border-bottom: 1px solid #000; margin: 0 auto 8px auto;"></div>
        <p style="margin: 0; font-size: 13px; font-weight: bold;">{{nome_loja}}</p>
        <p style="margin: 0; font-size: 12px; color: #666;">Assinatura do Recebedor / Lançador</p>
    </div>
</div>`
        };
    }
};
