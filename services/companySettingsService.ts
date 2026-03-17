import { supabase } from './supabase';
import { CompanySettings, CompanySettingsInput } from '../types/companySettings';

/**
 * Company Settings Service
 * Manages company information for receipts and documents
 *
 * CACHE STRATEGY (two layers):
 *  1. In-memory: 5 minutes — zero latency for same-session reloads
 *  2. localStorage: 30 minutes — zero Supabase queries on cold reload
 */

const LS_KEY = 'mdv_company_settings';
const LS_TTL = 30 * 60 * 1000; // 30 min
const MEM_TTL = 5 * 60 * 1000; // 5 min

let _memCache: { data: CompanySettings; expiresAt: number } | null = null;

function _readLocalStorage(): CompanySettings | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const { data, expiresAt } = JSON.parse(raw);
        if (Date.now() > expiresAt) { localStorage.removeItem(LS_KEY); return null; }
        return data as CompanySettings;
    } catch { return null; }
}

function _writeLocalStorage(data: CompanySettings): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({ data, expiresAt: Date.now() + LS_TTL }));
    } catch { /* quota exceeded — silenciar */ }
}

function _invalidateCache(): void {
    _memCache = null;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export const companySettingsService = {
    /**
     * Get company settings
     * Returns the first (and should be only) company settings record
     */
    async get(): Promise<CompanySettings | null> {
        // 1. In-memory cache
        if (_memCache && Date.now() < _memCache.expiresAt) return _memCache.data;

        // 2. localStorage cache
        const cached = _readLocalStorage();
        if (cached) {
            _memCache = { data: cached, expiresAt: Date.now() + MEM_TTL };
            return cached;
        }
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

                // Fallback for empty templates
                const defaults = this.getDefaults();
                data.payment_receipt_template = data.payment_receipt_template || defaults.payment_receipt_template;
                data.debt_clearance_template = data.debt_clearance_template || defaults.debt_clearance_template;
                data.extended_warranty_template = data.extended_warranty_template || defaults.extended_warranty_template;
            }

            // 3. Save to both caches
            if (data) {
                _memCache = { data, expiresAt: Date.now() + MEM_TTL };
                _writeLocalStorage(data);
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
        _invalidateCache(); // Limpa cache antes de atualizar
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
            receipt_show_extra_page: false,
            default_a4_header: `<div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
    <div style="flex: 1;">
        {{logo}}
    </div>
    <div style="flex: 2; text-align: right;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">{{nome_documento}}</h2>
        <p style="margin: 5px 0 0; font-weight: bold;">{{nome_loja}}</p>
        <p style="margin: 0; font-size: 11px;">CNPJ: {{cnpj}}</p>
        <p style="margin: 0; font-size: 11px;">{{endereco}}</p>
        <p style="margin: 0; font-size: 11px;">{{telefone}} | {{email}}</p>
    </div>
</div>`,
            default_thermal_header: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; text-align: center;">
    <div>
        {{logo}}
    </div>
    <div style="text-align: center;">
        <p style="font-size:10px; color:#64748b; margin-bottom: 2px;">CNPJ: {{cnpj}}</p>
        <p style="font-size:10px; color:#64748b; margin-bottom: 2px;">{{endereco}}</p>
        <p style="font-size:10px; color:#64748b; margin-bottom: 6px;">Tel: {{telefone}}</p>
        <p style="font-size:12px; font-weight:700; text-transform:uppercase; color:#475569; letter-spacing:0.5px; margin-bottom: 0px;">{{nome_documento}}</p>
    </div>
</div>`,
            debt_clearance_template: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px;">
    {{cabecalho_a4}}

    <h1 style="text-align: center; margin: 40px 0; text-transform: uppercase;">CARTA DE QUITAÇÃO DE DÉBITOS</h1>

        <p>Histórico / Referência do Pagamento:<br>
        <em>{{historico_conta}}</em></p>
    </div>

    <div style="margin-top: 80px; text-align: center;">
        <p>___________________________________________________</p>
        <p><strong>{{nome_loja}}</strong><br>
        CNPJ: {{cnpj}}</p>
        <p style="margin-top: 20px;">Emitido em: {{data_emissao}}</p>
    </div>
</div>`,
            delivery_receipt_template: `<div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #222; max-width: 800px; margin: 0 auto; padding: 32px;">
    {{cabecalho_a4}}

    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
        <div>
            <p style="margin:0;font-size:11px;color:#888;">Pedido</p>
            <p style="margin:0;font-size:14px;font-weight:700;font-family:monospace;">#{{numero_pedido}}</p>
        </div>
        <div style="text-align:right;">
            <p style="margin:0;font-size:11px;color:#888;">Emitido em</p>
            <p style="margin:0;">{{data_emissao}}</p>
        </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="background:#f5f5f5;">
            <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;">Dados do Cliente</td>
        </tr>
        <tr>
            <td style="padding:6px 10px;width:50%;"><strong>Nome:</strong> {{nome_cliente}}</td>
            <td style="padding:6px 10px;"><strong>Telefone:</strong> {{telefone_cliente}}</td>
        </tr>
        <tr>
            <td colspan="2" style="padding:6px 10px;"><strong>Endereço de Entrega:</strong> {{endereco_entrega}}</td>
        </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
            <tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Produto</th>
                <th style="padding:8px;text-align:right;">Total</th>
            </tr>
        </thead>
        <tbody>
            {{itens_pedido}}
        </tbody>
        <tfoot>
            <tr style="border-top:2px solid #333;">
                <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:14px;">TOTAL</td>
                <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:14px;">{{total_pedido}}</td>
            </tr>
        </tfoot>
    </table>

    <div style="margin-top:40px;border:1px dashed #999;border-radius:8px;padding:20px;">
        <p style="margin:0 0 4px;font-weight:700;font-size:12px;text-transform:uppercase;">Confirmação de Recebimento</p>
        <p style="margin:0 0 30px;font-size:12px;color:#555;">Declaro ter recebido os produtos acima em perfeitas condições.</p>
        <div style="display:flex;gap:40px;">
            <div style="flex:1;">
                <div style="border-bottom:1px solid #333;margin-bottom:6px;height:40px;"></div>
                <p style="margin:0;font-size:11px;color:#666;">Assinatura do cliente</p>
            </div>
            <div style="flex:1;">
                <div style="border-bottom:1px solid #333;margin-bottom:6px;height:40px;"></div>
                <p style="margin:0;font-size:11px;color:#666;">Data e hora</p>
            </div>
        </div>
    </div>

    <p style="margin-top:16px;font-size:10px;color:#aaa;text-align:center;">{{nome_loja}} · Emitido em {{data_emissao}}</p>
</div>`,
            payment_receipt_template: `<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px;">
    {{cabecalho_a4}}
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
    <div style="background-color: #f0f8ff; border: 1px dashed #007bff; padding: 15px; margin-bottom: 40px; font-size: 13px; text-align: center;">
        <p style="margin: 0;">{{texto_abertura}} a quantia de <strong>{{valor}}</strong> referente a <strong>{{historico}}</strong>.</p>
    </div>
    <div style="margin-top: 50px; text-align: center;">
        <div style="border-bottom: 2px solid #000; width: 400px; margin: 0 auto 10px;"></div>
        <strong>{{nome_loja}}</strong><br/>
        <small>Assinatura do Recebedor / Lançador</small>
    </div>
</div>`,
            extended_warranty_template: `<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 8px;">
    {{cabecalho_a4}}
    <div style="text-align: center; margin: 20px 0 30px 0; padding-bottom: 10px; border-bottom: 2px solid #2563eb;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px;">Certificado de Garantia Estendida</h1>
        <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">Proteção Adicional e Segurança para o seu Aparelho</p>
    </div>
    <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 25px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 8px 12px; font-weight: bold; font-size: 11px; color: #475569; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">Dados do Cliente</div>
            <div style="padding: 12px;">
                <p style="margin: 0 0 4px;"><strong>Nome:</strong> {{nome_cliente}}</p>
                <p style="margin: 0 0 4px;"><strong>CPF/CNPJ:</strong> {{cpf_cliente}}</p>
                <p style="margin: 0;"><strong>Contato:</strong> {{telefone_cliente}}</p>
            </div>
        </div>
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 8px 12px; font-weight: bold; font-size: 11px; color: #475569; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">Identificação do Aparelho</div>
            <div style="padding: 12px;">
                <p style="margin: 0 0 4px;"><strong>Modelo:</strong> {{produto}}</p>
                <p style="margin: 0 0 4px;"><strong>IMEI 1:</strong> {{imei1}}</p>
                <p style="margin: 0;"><strong>IMEI 2:</strong> {{imei2}}</p>
            </div>
        </div>
    </div>
    <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 30px;">
        <div style="background-color: #eff6ff; padding: 10px 15px; font-weight: bold; font-size: 13px; color: #1e40af; border-bottom: 1px solid #bfdbfe; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
            <span>Resumo da Cobertura Estendida</span>
            <span style="background: #2563eb; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Válido e Ativo</span>
        </div>
        <div style="padding: 15px; display: flex; justify-content: space-between; flex-wrap: wrap;">
            <div style="width: 48%; margin-bottom: 10px;">
                <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase;">Prazo Adicional</p>
                <p style="margin: 2px 0 0; font-weight: bold; font-size: 14px; color: #0f172a;">{{meses_garantia_estendida}} Meses</p>
            </div>
            <div style="width: 48%; margin-bottom: 10px;">
                <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase;">Valor Contratado</p>
                <p style="margin: 2px 0 0; font-weight: bold; font-size: 14px; color: #16a34a;">{{valor_garantia_estendida}}</p>
            </div>
            <div style="width: 48%;">
                <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase;">Início da Cobertura</p>
                <p style="margin: 2px 0 0; font-weight: bold; font-size: 14px; color: #0f172a;">{{data_inicio_estendida}}</p>
            </div>
            <div style="width: 48%;">
                <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase;">Fim da Cobertura (Vencimento)</p>
                <p style="margin: 2px 0 0; font-weight: bold; font-size: 14px; color: #dc2626;">{{data_fim_estendida}}</p>
            </div>
        </div>
    </div>
    <div style="margin-bottom: 40px; font-size: 11px; color: #475569; text-align: justify; padding: 15px; background-color: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
        <p style="margin: 0 0 8px;"><strong>1. DO OBJETO:</strong> O presente certificado garante o reparo gratuito ou substituição de peças do aparelho descrito acima que apresentem defeito de fabricação ou vício de qualidade durante o prazo estendido contratado.</p>
        <p style="margin: 0 0 8px;"><strong>2. DA VIGÊNCIA:</strong> A cobertura estendida inicia-se imediatamente após o término da garantia legal/padrão da loja e vigora até a data de vencimento especificada neste certificado.</p>
        <p style="margin: 0;"><strong>3. DAS EXCLUSÕES:</strong> Esta garantia <u>NÃO COBRE</u>: danos físicos, danos por líquidos, mau uso, desgaste natural (bateria), instalação de software não-oficial e intervenção técnica por terceiros não autorizados.</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 20px;">
        <div style="width: 40%; text-align: center;">
            <div style="border-bottom: 1px solid #000; margin-bottom: 8px;"></div>
            <p style="margin: 0; font-weight: bold; font-size: 12px; color: #0f172a;">{{nome_loja}}</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #64748b;">Representante / Vendedor</p>
        </div>
        <div style="width: 40%; text-align: center;">
            <div style="border-bottom: 1px solid #000; margin-bottom: 8px;"></div>
            <p style="margin: 0; font-weight: bold; font-size: 12px; color: #0f172a;">{{nome_cliente}}</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #64748b;">Titular do Contrato / Cliente</p>
        </div>
    </div>
</div>`,
        };
    }
};
