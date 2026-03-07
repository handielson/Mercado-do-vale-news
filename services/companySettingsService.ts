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
            payment_receipt_template: `<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px;">
    <!-- CABEÇALHO -->
    <div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
        <div style="flex: 1;">
            {{logo}}
        </div>
        <div style="flex: 2; text-align: right;">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">RECIBO</h2>
            <p style="margin: 5px 0 0; font-weight: bold;">{{nome_loja}}</p>
            <p style="margin: 0; font-size: 11px;">{{cnpj}}</p>
            <p style="margin: 0; font-size: 11px;">{{endereco}}</p>
            <p style="margin: 0; font-size: 11px;">{{telefone}} | {{email}}</p>
            <p style="margin: 10px 0 0; font-size: 14px; font-weight: bold; color: #007bff;">Nº Recibo: {{numero_recibo}}</p>
        </div>
    </div>

    <!-- CORPO -->
    <div style="background-color: #f9f9f9; padding: 10px; border: 1px solid #eee; margin-bottom: 20px; display: flex; justify-content: space-between;">
        <div style="width: 48%;">
            <p style="margin: 0 0 5px; font-weight: bold; border-bottom: 1px solid #ddd;">DADOS DO CLIENTE / FORNECEDOR</p>
            <p style="margin: 2px 0;"><strong>Nome:</strong> {{nome_cliente}}</p>
            <p style="margin: 2px 0;"><strong>Documento:</strong> {{cpf_cliente}}</p>
            <p style="margin: 2px 0;"><strong>Data:</strong> {{data_emissao}}</p>
        </div>
        <div style="width: 48%; text-align: right;">
            <p style="margin: 0 0 5px; font-weight: bold; border-bottom: 1px solid #ddd;">VALOR DO RECIBO</p>
            <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">{{valor}}</p>
        </div>
    </div>

    <!-- DECLARAÇÃO -->
    <div style="background-color: #f0f8ff; border: 1px dashed #007bff; padding: 15px; margin-bottom: 40px; font-size: 13px; text-align: center;">
        <p style="margin: 0;">
            {{texto_abertura}} a quantia de <strong>{{valor}}</strong> referente a <strong>{{historico}}</strong>.
        </p>
    </div>

    <!-- ASSINATURA -->
    <div style="margin-top: 50px; text-align: center;">
        <div style="border-bottom: 2px solid #000; width: 400px; margin: 0 auto 10px;"></div>
        <strong>{{nome_loja}}</strong><br/>
        <small>Assinatura do Recebedor / Lançador</small>
    </div>
</div>`
        };
    }
};
