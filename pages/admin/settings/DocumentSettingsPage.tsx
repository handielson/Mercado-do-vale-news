import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Save, Loader2, Receipt, Shield, QrCode, Package, User, Tag, Copy } from 'lucide-react';
import QRCode from 'react-qr-code';
import { companySettingsService } from '../../../services/companySettingsService';
import { CompanySettings, CompanySettingsInput } from '../../../types/companySettings';
import { WARRANTY_TAGS } from '../../../types/warrantyDocument';
import { WarrantyTemplateEditor } from '../../../components/settings/WarrantyTemplateEditor';
import { PaymentReceiptTemplateEditor } from '../../../components/settings/PaymentReceiptTemplateEditor';
import { HeaderTemplateEditor } from '../../../components/settings/HeaderTemplateEditor';
import { DebtClearanceTemplateEditor } from '../../../components/settings/DebtClearanceTemplateEditor';
import { toast } from 'sonner';
import { useTheme } from '../../../contexts/ThemeContext';

type TabType = 'receipt' | 'warranty' | 'extra_page' | 'extended_warranty' | 'payment_receipt' | 'headers' | 'debt_clearance' | 'delivery_receipt' | 'tags_dictionary';

const GLOBAL_DOCUMENT_TAGS: Record<string, string> = {
    ...WARRANTY_TAGS,

    // Documentos Dinâmicos e Cabeçalhos
    cabecalho_a4: 'Injeta as configurações da aba Cabeçalhos (A4)',
    cabecalho_termico: 'Injeta as configurações da aba Cabeçalhos (Térmica)',
    nome_documento: 'Nome dinâmico do documento (RECIBO, TERMO, CARTA, etc)',
    texto_abertura: 'Frase "Recebemos de [nome]" ou "Pagamos a [nome]"',

    // Financeiro / Recibos / Quitação
    valor: 'Valor Pago/Recebido (ex: R$ 1.500,00)',
    historico: 'Histórico principal da Conta',
    data_emissao: 'Data atual de Emissão do Documento',
    numero_recibo: 'Número de Controle do Recibo/Conta no sistema',
    valor_quitado: 'Valor liquidado formatado em R$ (Ex: R$ 1.500,00)',
    historico_conta: 'Histórico completo da Conta Baixada',

    // Garantia Estendida
    meses_garantia_estendida: 'Prazo extra concedido (Ex: 12 meses)',
    valor_garantia_estendida: 'Valor cobrado na garantia (Ex: R$ 150,00)',
    data_inicio_estendida: 'Data de Início da Cobertura Estendida',
    data_fim_estendida: 'Data Final da Cobertura Estendida'
};

export default function DocumentSettingsPage() {
    const navigate = useNavigate();
    const { settings: themeSettings } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('receipt');
    const [settings, setSettings] = useState<CompanySettingsInput>({
        company_name: 'Mercado do Vale',
        header_text: '',
        footer_text: '',
        warranty_terms: '',
        receipt_width: '80mm',
        show_company_info: true,
        show_order_number: true,
        show_timestamp: true,
        show_seller_info: true,
        warranty_template: '',
        warranty_show_logo: true,
        warranty_show_company_name: true,
        warranty_show_cnpj: false,
        warranty_show_phone: true,
        warranty_show_email: true,
        warranty_show_address: true,
        receipt_extra_page_text: '',
        receipt_extra_page_qr_url: '',
        receipt_show_extra_page: false,
        payment_receipt_template: '',
        debt_clearance_template: '',
        default_a4_header: '',
        default_thermal_header: '',
        extended_warranty_options: [],
        extended_warranty_terms_text: '',
        extended_warranty_template: '',
        delivery_receipt_template: ''
    });

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await companySettingsService.get();
            const defaults = companySettingsService.getDefaults();

            if (data) {
                setSettings({
                    company_name: data.company_name,
                    header_text: data.header_text || '',
                    footer_text: data.footer_text || '',
                    warranty_terms: data.warranty_terms || '',
                    receipt_logo_url: data.receipt_logo_url || '',
                    receipt_width: data.receipt_width,
                    show_company_info: data.show_company_info,
                    show_order_number: data.show_order_number,
                    show_timestamp: data.show_timestamp,
                    show_seller_info: data.show_seller_info,
                    warranty_template: data.warranty_template || '',
                    warranty_show_logo: data.warranty_show_logo,
                    warranty_show_company_name: data.warranty_show_company_name,
                    warranty_show_cnpj: data.warranty_show_cnpj,
                    warranty_show_phone: data.warranty_show_phone,
                    warranty_show_email: data.warranty_show_email,
                    warranty_show_address: data.warranty_show_address,
                    receipt_extra_page_text: data.receipt_extra_page_text || '',
                    receipt_extra_page_qr_url: data.receipt_extra_page_qr_url || '',
                    receipt_show_extra_page: data.receipt_show_extra_page || false,
                    payment_receipt_template: data.payment_receipt_template || '',
                    debt_clearance_template: data.debt_clearance_template || defaults.debt_clearance_template || '',
                    default_a4_header: data.default_a4_header || defaults.default_a4_header || '',
                    default_thermal_header: data.default_thermal_header || defaults.default_thermal_header || '',
                    extended_warranty_options: data.extended_warranty_options || [],
                    extended_warranty_terms_text: data.extended_warranty_terms_text || '',
                    extended_warranty_template: data.extended_warranty_template || defaults.extended_warranty_template || '',
                    delivery_receipt_template: data.delivery_receipt_template || defaults.delivery_receipt_template || ''
                });
            } else {
                // Use defaults
                setSettings(prev => ({ ...prev, ...defaults }));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await companySettingsService.update(settings);
            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof CompanySettingsInput, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    // Helper para gerar o texto de preview com dados fictícios
    const getPreviewText = () => {
        let text = settings.receipt_extra_page_text || '';
        if (!text) return '';

        text = text.replace(/\{\{cliente_nome\}\}/g, 'João da Silva');
        text = text.replace(/\{\{cliente_documento\}\}/g, '123.456.789-00');
        text = text.replace(/\{\{cliente_telefone\}\}/g, '(11) 98765-4321');
        text = text.replace(/\{\{cliente_email\}\}/g, 'joao@email.com');
        text = text.replace(/\{\{empresa_nome\}\}/g, settings.company_name || 'Mercado do Vale');
        text = text.replace(/\{\{empresa_telefone\}\}/g, settings.phone || '(11) 3210-9876');
        text = text.replace(/\{\{empresa_email\}\}/g, settings.email || 'contato@mercadodovale.com.br');
        text = text.replace(/\{\{empresa_cnpj\}\}/g, settings.cnpj || '12.345.678/0001-90');
        text = text.replace(/\{\{empresa_endereco\}\}/g, settings.address || 'Rua Fictícia, 123 - Centro');

        const now = new Date();
        text = text.replace(/\{\{data_venda\}\}/g, now.toLocaleDateString('pt-BR'));
        text = text.replace(/\{\{hora_venda\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        text = text.replace(/\{\{numero_pedido\}\}/g, '0001234');

        return text;
    };

    const handleCopyTag = (tag: string) => {
        navigator.clipboard.writeText(tag);
        toast.success(`Tag ${tag} copiada!`);
    };

    const handleAddWarrantyOption = () => {
        const options = [...(settings.extended_warranty_options || [])];
        options.push({ months: 12, percentage: 10, active: true });
        handleChange('extended_warranty_options', options);
    };

    const handleUpdateWarrantyOption = (index: number, field: string, value: any) => {
        const options = [...(settings.extended_warranty_options || [])];
        options[index] = { ...options[index], [field]: value };
        handleChange('extended_warranty_options', options);
    };

    const handleRemoveWarrantyOption = (index: number) => {
        const options = [...(settings.extended_warranty_options || [])];
        options.splice(index, 1);
        handleChange('extended_warranty_options', options);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/settings')}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={28} />
                                    Configurações de Documentos
                                </h1>
                                <p className="text-sm text-slate-600">
                                    Configure recibos, termos de garantia e outros documentos
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>

                    {/* Tabs — Segmented Control */}
                    <div className="mt-4 overflow-x-auto">
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-max min-w-full">
                            {([
                                { id: 'receipt', label: 'Cupom Térmico', icon: <Receipt size={14} /> },
                                { id: 'payment_receipt', label: 'Recibo A4', icon: <FileText size={14} /> },
                                { id: 'debt_clearance', label: 'Quitação', icon: <FileText size={14} /> },
                                { id: 'delivery_receipt', label: 'Comprovante', icon: <Package size={14} /> },
                                { id: 'warranty', label: 'Garantia', icon: <Shield size={14} /> },
                                { id: 'extended_warranty', label: 'G. Estendida', icon: <Shield size={14} /> },
                                { id: 'headers', label: 'Cabeçalhos', icon: <FileText size={14} /> },
                                { id: 'extra_page', label: 'Folha Extra', icon: <QrCode size={14} /> },
                                { id: 'tags_dictionary', label: 'Dicionário de Tags', icon: <Tag size={14} /> },
                            ] as { id: TabType; label: string; icon: React.ReactNode }[]).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                                        }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'receipt' && (
                    <div className="space-y-6">
                        {/* Customização do Recibo */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                Customização do Recibo
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Texto do Cabeçalho
                                    </label>
                                    <textarea
                                        value={settings.header_text}
                                        onChange={(e) => handleChange('header_text', e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: Bem-vindo ao Mercado do Vale!"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Mensagem exibida no topo do recibo
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Texto do Rodapé
                                    </label>
                                    <textarea
                                        value={settings.footer_text}
                                        onChange={(e) => handleChange('footer_text', e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: Obrigado pela preferência! Volte sempre!"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Mensagem exibida no final do recibo
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Termos de Garantia
                                    </label>
                                    <textarea
                                        value={settings.warranty_terms}
                                        onChange={(e) => handleChange('warranty_terms', e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: Este recibo é parte integrante do termo de garantia. Prazo de garantia: 90 dias para defeitos de fabricação..."
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Termos de garantia exibidos no recibo (parte integrante do documento)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Largura do Papel
                                    </label>
                                    <select
                                        value={settings.receipt_width}
                                        onChange={(e) => handleChange('receipt_width', e.target.value as '58mm' | '80mm' | '100mm')}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="58mm">58mm (Impressora Térmica Pequena)</option>
                                        <option value="80mm">80mm (Impressora Térmica Padrão)</option>
                                        <option value="100mm">100mm (Impressora Térmica Larga / A6)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Opções de Exibição */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                Opções de Exibição no Recibo
                            </h2>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.show_company_info}
                                        onChange={(e) => handleChange('show_company_info', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Exibir informações da empresa no recibo
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.show_order_number}
                                        onChange={(e) => handleChange('show_order_number', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Exibir número do pedido
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.show_timestamp}
                                        onChange={(e) => handleChange('show_timestamp', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Exibir data e hora da venda
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.show_seller_info}
                                        onChange={(e) => handleChange('show_seller_info', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Exibir informações do vendedor
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payment_receipt' && (
                    <PaymentReceiptTemplateEditor
                        template={settings.payment_receipt_template || ''}
                        onTemplateChange={(value) => handleChange('payment_receipt_template', value)}
                        logoUrl={themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url || ''}
                        getPreviewHTML={(template, logo) => {
                            const svgPlaceholder = `data:image/svg+xml;base64,${btoa(`<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`)}`;
                            const logoSrc = logo || svgPlaceholder;
                            const logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height:80px; max-width:150px; object-fit:contain;" />`;

                            const cabecalhoA4 = (settings.default_a4_header || '')
                                .replace(/{{logo}}/g, logoHtml)
                                .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                .replace(/{{endereco}}/g, settings.address || 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                .replace(/{{email}}/g, settings.email || 'contato@mercadodovale.com.br')
                                .replace(/{{nome_documento}}/g, 'RECIBO DE PAGAMENTO');

                            let processedTemplate = template.replace(/<img[^>]*src="\{\{logo\}\}"[^>]*>/g, logoHtml);

                            return processedTemplate
                                .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
                                .replace(/{{logo}}/g, logoSrc)
                                .replace(/{{nome_loja}}/g, 'Mercado do Vale')
                                .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, '(11) 98765-4321')
                                .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
                                .replace(/{{cnpj}}/g, '12.345.678/0001-90')
                                .replace(/{{nome_cliente}}/g, 'João da Silva')
                                .replace(/{{cpf_cliente}}/g, '123.456.789-00')
                                .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
                                .replace(/{{email_cliente}}/g, 'joao@email.com')
                                .replace(/{{numero_recibo}}/g, 'REC-999')
                                .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
                                .replace(/{{valor}}/g, 'R$ 1.500,00')
                                .replace(/{{historico}}/g, 'Compra do pedido #1234')
                                .replace(/{{texto_abertura}}/g, 'Recebemos de <strong>João da Silva</strong>');
                        }}
                    />
                )}

                {activeTab === 'debt_clearance' && (
                    <DebtClearanceTemplateEditor
                        template={settings.debt_clearance_template || ''}
                        onTemplateChange={(value) => handleChange('debt_clearance_template', value)}
                        logoUrl={themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url || ''}
                        getPreviewHTML={(template, logo) => {
                            const svgPlaceholder = `data:image/svg+xml;base64,${btoa(`<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`)}`;
                            const logoSrc = logo || svgPlaceholder;
                            const logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height:80px; max-width:150px; object-fit:contain;" />`;

                            const cabecalhoA4 = (settings.default_a4_header || '')
                                .replace(/{{logo}}/g, logoHtml)
                                .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                .replace(/{{endereco}}/g, settings.address || 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                .replace(/{{email}}/g, settings.email || 'contato@mercadodovale.com.br')
                                .replace(/{{nome_documento}}/g, 'CARTA DE QUITAÇÃO DE DÉBITOS');

                            let processedTemplate = template.replace(/<img[^>]*src="\{\{logo\}\}"[^>]*>/g, logoHtml);

                            return processedTemplate
                                .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
                                .replace(/{{logo}}/g, logoSrc)
                                .replace(/{{nome_loja}}/g, 'Mercado do Vale')
                                .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, '(11) 98765-4321')
                                .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
                                .replace(/{{cnpj}}/g, '12.345.678/0001-90')
                                .replace(/{{nome_cliente}}/g, 'João da Silva')
                                .replace(/{{cpf_cliente}}/g, '123.456.789-00')
                                .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
                                .replace(/{{numero_recibo}}/g, '14002')
                                .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
                                .replace(/{{valor_quitado}}/g, 'R$ 1.500,00')
                                .replace(/{{historico_conta}}/g, 'Referente ao conserto de tela do iPhone 13');
                        }}
                    />
                )}

                {activeTab === 'delivery_receipt' && (
                    <DebtClearanceTemplateEditor
                        template={settings.delivery_receipt_template || ''}
                        onTemplateChange={(value) => handleChange('delivery_receipt_template', value)}
                        logoUrl={themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url || ''}
                        getPreviewHTML={(template, logo) => {
                            const svgPlaceholder = `data:image/svg+xml;base64,${btoa(`<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`)}`;
                            const logoSrc = logo || svgPlaceholder;
                            const logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height:80px; max-width:150px; object-fit:contain;" />`;

                            const cabecalhoA4 = (settings.default_a4_header || '')
                                .replace(/{{logo}}/g, logoHtml)
                                .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                .replace(/{{endereco}}/g, settings.address || 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                .replace(/{{email}}/g, settings.email || 'contato@mercadodovale.com.br')
                                .replace(/{{nome_documento}}/g, 'COMPROVANTE DE ENTREGA');

                            let processedTemplate = template.replace(/<img[^>]*src="\{\{logo\}\}"[^>]*>/g, logoHtml);

                            return processedTemplate
                                .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
                                .replace(/{{logo}}/g, logoSrc)
                                .replace(/{{nome_loja}}/g, 'Mercado do Vale')
                                .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, '(11) 98765-4321')
                                .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
                                .replace(/{{cnpj}}/g, '12.345.678/0001-90')
                                .replace(/{{numero_pedido}}/g, 'PED-001234')
                                .replace(/{{nome_cliente}}/g, 'João da Silva')
                                .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
                                .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
                                .replace(/{{itens_pedido}}/g, '<p>1x Capa de Silicone - Preto - SKU: CAPA-001 .... R$ 14,90</p>')
                                .replace(/{{total_pedido}}/g, 'R$ 14,90')
                                .replace(/{{endereco_entrega}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF');
                        }}
                    />
                )}

                {activeTab === 'headers' && (
                    <HeaderTemplateEditor
                        templateA4={settings.default_a4_header || ''}
                        templateThermal={settings.default_thermal_header || ''}
                        onTemplateA4Change={(value) => handleChange('default_a4_header', value)}
                        onTemplateThermalChange={(value) => handleChange('default_thermal_header', value)}
                        logoUrl={themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url || ''}
                        showLogo={settings.warranty_show_logo || false}
                        showCompanyName={settings.warranty_show_company_name || false}
                        showCnpj={settings.warranty_show_cnpj || false}
                        showPhone={settings.warranty_show_phone || false}
                        showEmail={settings.warranty_show_email || false}
                        showAddress={settings.warranty_show_address || false}
                        onToggle={handleChange}
                    />
                )}

                {activeTab === 'warranty' && (
                    <WarrantyTemplateEditor
                        title="Template da Garantia de Loja"
                        template={settings.warranty_template || ''}
                        onTemplateChange={(value) => handleChange('warranty_template', value)}
                        logoUrl={themeSettings?.logo_main || settings.receipt_logo_url || ''}
                        tagsDict={WARRANTY_TAGS}
                        getPreviewHTML={(template, logo) => {
                            const svgPlaceholder = `data:image/svg+xml;base64,${btoa(`<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`)}`;
                            const logoSrc = logo || svgPlaceholder;
                            const logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height:80px; max-width:150px; object-fit:contain;" />`;

                            const cabecalhoA4 = (settings.default_a4_header || '')
                                .replace(/{{logo}}/g, logoHtml)
                                .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                .replace(/{{endereco}}/g, settings.address || 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                .replace(/{{email}}/g, settings.email || 'contato@mercadodovale.com.br')
                                .replace(/{{nome_documento}}/g, 'TERMO DE GARANTIA');

                            // Para garantir compatibilidade com templates antigos que já tenham a tag img com {{logo}} no src
                            let processedTemplate = template.replace(/<img[^>]*src="\{\{logo\}\}"[^>]*>/g, logoHtml);

                            return processedTemplate
                                .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
                                .replace(/{{logo}}/g, logoSrc) // Se sobrou algum solto, substitui só pelo link
                                .replace(/{{nome_loja}}/g, 'Mercado do Vale')
                                .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                .replace(/{{telefone}}/g, '(11) 98765-4321')
                                .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
                                .replace(/{{cnpj}}/g, '12.345.678/0001-90')
                                .replace(/{{nome_cliente}}/g, 'João da Silva')
                                .replace(/{{cpf_cliente}}/g, '123.456.789-00')
                                .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
                                .replace(/{{email_cliente}}/g, 'joao@email.com')
                                .replace(/{{numero_venda}}/g, 'VD-12345')
                                .replace(/{{data_compra}}/g, new Date().toLocaleDateString('pt-BR'))
                                .replace(/{{produto}}/g, 'iPhone 13 128GB')
                                .replace(/{{marca}}/g, 'Apple')
                                .replace(/{{modelo}}/g, 'iPhone 13')
                                .replace(/{{cor}}/g, 'Azul')
                                .replace(/{{ram}}/g, '4GB')
                                .replace(/{{memoria}}/g, '128GB')
                                .replace(/{{imei1}}/g, '123456789012345')
                                .replace(/{{imei2}}/g, '543210987654321')
                                .replace(/{{dias_garantia}}/g, '90')
                                .replace(/{{tipo_garantia}}/g, 'Garantia Legal')
                                .replace(/{{declaracao_recebimento}}/g, 'Declaro que retirei a mercadoria na loja em perfeito estado e testei.');
                        }}
                    />
                )}

                {activeTab === 'extra_page' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Configurações */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                    Configuração da Folha Extra
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Uma folha adicional opcional, impressa logo após o recibo de venda. Ideal para incluir o QR Code de acesso ao sistema do cliente, manuais ou links importantes.
                                </p>

                                <div className="space-y-6">
                                    <label className="flex items-start gap-3 cursor-pointer p-4 border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors rounded-lg">
                                        <div className="pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={settings.receipt_show_extra_page || false}
                                                onChange={(e) => handleChange('receipt_show_extra_page', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-sm font-semibold text-slate-800 block mb-0.5">
                                                Habilitar Folha Extra no Recibo
                                            </span>
                                            <span className="text-xs text-slate-600">
                                                Se ativado, uma nova página separada será gerada no momento da impressão do recibo contendo as informações configuradas abaixo.
                                            </span>
                                        </div>
                                    </label>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            URL do QR Code
                                        </label>
                                        <input
                                            type="url"
                                            value={settings.receipt_extra_page_qr_url || ''}
                                            onChange={(e) => handleChange('receipt_extra_page_qr_url', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ex: https://sistema.mercadodovale.com.br/acesso-cliente"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Este link será transformado automaticamente em um QR Code legível na impressão da folha.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Mensagem Principal (Aviso ou Instruções)
                                        </label>
                                        <textarea
                                            value={settings.receipt_extra_page_text || ''}
                                            onChange={(e) => handleChange('receipt_extra_page_text', e.target.value)}
                                            rows={8}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                            placeholder="Olá {{cliente_nome}}, acesse o link abaixo ou leia o QR Code com a câmera do seu celular para acompanhar seus pedidos na {{empresa_nome}}..."
                                        />

                                        <div className="mt-3 bg-slate-50 p-3 rounded border border-slate-200">
                                            <p className="text-xs font-semibold text-slate-700 mb-2">Tags Disponíveis (clique para copiar):</p>

                                            <p className="text-xs text-slate-500 mb-1 mt-0">📋 Geral</p>
                                            <div className="flex flex-wrap gap-2 text-xs font-mono mb-3">
                                                {[
                                                    '{{cliente_nome}}', '{{cliente_documento}}', '{{cliente_telefone}}', '{{cliente_email}}',
                                                    '{{empresa_nome}}', '{{empresa_telefone}}', '{{empresa_email}}', '{{empresa_cnpj}}', '{{empresa_endereco}}',
                                                    '{{data_venda}}', '{{hora_venda}}', '{{numero_pedido}}'
                                                ].map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => handleCopyTag(tag)}
                                                        className="bg-slate-200 hover:bg-slate-300 border border-slate-300 px-2 py-1 rounded text-slate-700 transition-colors cursor-copy shadow-sm active:scale-95"
                                                        title={`Copiar ${tag}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>

                                            <p className="text-xs text-slate-500 mb-1">🎬 Películas</p>
                                            <div className="flex flex-wrap gap-2 text-xs font-mono mb-3">
                                                {[
                                                    '{{pelicula_saldo}}', '{{pelicula_usadas}}', '{{pelicula_ganhas}}'
                                                ].map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => handleCopyTag(tag)}
                                                        className="bg-purple-100 hover:bg-purple-200 border border-purple-300 px-2 py-1 rounded text-purple-800 transition-colors cursor-copy shadow-sm active:scale-95"
                                                        title={`Copiar ${tag}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>

                                            <p className="text-xs text-slate-500 mb-1">🪙 Moedas do Vale</p>
                                            <div className="flex flex-wrap gap-2 text-xs font-mono">
                                                {[
                                                    '{{moedas_saldo}}', '{{moedas_ganhas_venda}}', '{{moedas_ganhas_total}}'
                                                ].map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => handleCopyTag(tag)}
                                                        className="bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-1 rounded text-amber-800 transition-colors cursor-copy shadow-sm active:scale-95"
                                                        title={`Copiar ${tag}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="space-y-6">
                            <div className="bg-slate-100 rounded-xl border border-slate-300 p-6 relative overflow-hidden h-full min-h-[500px]">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center justify-between">
                                    <span>Preview em Tempo Real</span>
                                    <span className="flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                    </span>
                                </h3>

                                {settings.receipt_show_extra_page ? (
                                    <div className="flex flex-col items-center gap-6 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                        {/* Mock da Página 1 - Recibo Normal */}
                                        <div className="bg-white transform scale-[0.85] origin-top border-2 border-slate-200 shadow-md rounded-xl p-6 w-full max-w-[450px] opacity-80 pointer-events-none">
                                            <div className="border-b-2 border-slate-300 pb-4 mb-4 text-center">
                                                <div dangerouslySetInnerHTML={{
                                                    __html: (settings.default_thermal_header || '')
                                                        .replace(/{{logo}}/g, (themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url)
                                                            ? `<img src="${themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url}" alt="Logo Empresa" style="max-height:60px; object-fit:contain; margin:0 auto;" />`
                                                            : `<div style="width:120px; height:60px; background:#e2e8f0; margin:0 auto;"></div>`
                                                        )
                                                        .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                                        .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                                        .replace(/{{endereco}}/g, settings.address || 'Rua Fictícia, 123')
                                                        .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                                        .replace(/{{email}}/g, settings.email || '')
                                                        .replace(/{{nome_documento}}/g, 'COMPROVANTE DE VENDA')
                                                }} />
                                            </div>

                                            <div className="space-y-4 mb-6">
                                                <div className="border-b border-slate-200 pb-2">
                                                    <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold text-sm">
                                                        <User size={14} className="text-slate-600" /> Cliente
                                                    </div>
                                                    <div className="text-xs text-slate-600 ml-6 space-y-0.5">
                                                        <p className="font-medium text-slate-800">João da Silva</p>
                                                        <p>CPF/CNPJ: 123.456.789-00</p>
                                                    </div>
                                                </div>

                                                <div className="border-b border-slate-200 pb-2">
                                                    <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold text-sm">
                                                        <Package size={14} className="text-slate-600" /> Produtos
                                                    </div>
                                                    <div className="text-xs text-slate-600 ml-6 space-y-0.5">
                                                        <div className="flex justify-between">
                                                            <span>1x Smartphone Galaxy S24</span>
                                                            <span className="font-mono">R$ 5.999,00</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>1x Capa Protetora <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded ml-1">BRINDE</span></span>
                                                            <span className="font-mono text-slate-400 line-through">R$ 99,00</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t-2 border-slate-300">
                                                <div className="flex justify-between font-bold text-lg">
                                                    <span className="text-slate-800">TOTAL A PAGAR:</span>
                                                    <span className="font-mono text-blue-600">R$ 5.999,00</span>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-4 border-t border-slate-200">
                                                {settings.warranty_terms && (
                                                    <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg mb-4 text-left">
                                                        <h3 className="text-xs font-bold text-amber-900 uppercase mb-1 flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                                            Termos de Garantia
                                                        </h3>
                                                        <p className="text-[10px] text-slate-700 line-clamp-2 leading-relaxed">{settings.warranty_terms}</p>
                                                    </div>
                                                )}
                                                <div className="w-full py-2 bg-slate-200 text-slate-500 rounded-lg text-sm text-center font-medium">
                                                    Finalizar Venda (Mock)
                                                </div>
                                                <div className="mt-4 text-center text-xs text-slate-400 w-full pt-2">Página 1 de 2</div>
                                            </div>
                                        </div>

                                        {/* Separador Visual Virtual */}
                                        <div className="w-full border-t border-dashed border-slate-400 relative">
                                            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-100 px-2 text-xs text-slate-500 font-medium">Quebra de Página (Impressora)</span>
                                        </div>

                                        {/* Página 2 - Folha Extra */}
                                        <div className="bg-white transform scale-[0.85] origin-top border shadow-2xl rounded-sm p-4 sm:p-8 w-full max-w-[450px] flex flex-col items-center text-center">
                                            {(themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url) && (
                                                <img
                                                    src={themeSettings?.logo_main || (settings as any).logo || settings.receipt_logo_url}
                                                    alt="Logo Empresa"
                                                    className="max-w-[150px] max-h-[80px] object-contain mb-8"
                                                />
                                            )}

                                            <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                                {settings.receipt_extra_page_qr_url ? (
                                                    <div className="flex justify-center mb-6">
                                                        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                                                            <QRCode
                                                                value={settings.receipt_extra_page_qr_url}
                                                                size={160}
                                                                level="H"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-[160px] h-[160px] border-2 border-dashed border-slate-300 rounded-xl mx-auto mb-6 flex items-center justify-center flex-col text-slate-400">
                                                        <QrCode className="w-8 h-8 opacity-50 mb-2" />
                                                        <span className="text-xs">QR Code (Sem URL)</span>
                                                    </div>
                                                )}

                                                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap text-left min-h-[100px]">
                                                    {getPreviewText() || <span className="text-slate-400 italic">O texto configurado aparecerá aqui...</span>}
                                                </p>
                                            </div>

                                            <p className="text-xs text-slate-400 mt-4">
                                                Documento acessório ao recibo principal pedido #0001234
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                                        <FileText className="w-16 h-16 mb-4 opacity-30" />
                                        <p>A folha extra está desabilitada.</p>
                                        <p className="text-sm">Ative-a para ver o preview.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'extended_warranty' && (
                    <div className="grid grid-cols-1 gap-6">
                        {/* Configuração de Prazos */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex justify-between items-center">
                                    <span>Opções de Garantia</span>
                                    <button
                                        type="button"
                                        onClick={handleAddWarrantyOption}
                                        className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                                    >
                                        + Adicionar Opção
                                    </button>
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Defina prazos e percentuais oferecidos na garantia estendida. O valor final cobrado ao cliente será Produto × Percentual.
                                </p>

                                <div className="space-y-3">
                                    {(!settings.extended_warranty_options || settings.extended_warranty_options.length === 0) ? (
                                        <div className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
                                            Nenhuma opção cadastrada. O recurso ficará desabilitado nas vendas.
                                        </div>
                                    ) : (
                                        settings.extended_warranty_options.map((opt, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                <div className="flex-1 grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Prazo (Meses)</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={opt.months}
                                                            onChange={(e) => handleUpdateWarrantyOption(idx, 'months', Number(e.target.value))}
                                                            className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Taxa (%)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.1"
                                                            value={opt.percentage}
                                                            onChange={(e) => handleUpdateWarrantyOption(idx, 'percentage', Number(e.target.value))}
                                                            className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center justify-center pt-5">
                                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={opt.active}
                                                            onChange={(e) => handleUpdateWarrantyOption(idx, 'active', e.target.checked)}
                                                            className="text-blue-600 rounded"
                                                        />
                                                        <span className="text-xs font-medium text-slate-600">Ativa</span>
                                                    </label>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveWarrantyOption(idx)}
                                                        className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Editor de Texto com Tags do Regulamento Público */}
                        <div className="bg-white rounded-xl flex flex-col h-full border border-slate-200">
                            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-800">
                                    Template da Garantia Estendida
                                </h2>
                            </div>
                            <div className="p-0">
                                <WarrantyTemplateEditor
                                    title="Template da Garantia Estendida"
                                    template={settings.extended_warranty_template || ''}
                                    onTemplateChange={(value) => handleChange('extended_warranty_template', value)}
                                    logoUrl={themeSettings?.logo_main || settings.receipt_logo_url || ''}
                                    tagsDict={GLOBAL_DOCUMENT_TAGS}
                                    getPreviewHTML={(template, logo) => {
                                        const svgPlaceholder = `<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`;
                                        const logoHtml = logo
                                            ? `<img src="${logo}" alt="Logo" style="max-height:80px; max-width:150px; object-fit:contain;" />`
                                            : `<img src="data:image/svg+xml;base64,${btoa(svgPlaceholder)}" alt="Logo Placeholder" />`;

                                        const cabecalhoA4 = (settings.default_a4_header || '')
                                            .replace(/{{logo}}/g, logoHtml)
                                            .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                            .replace(/{{cnpj}}/g, settings.cnpj || '12.345.678/0001-90')
                                            .replace(/{{endereco}}/g, settings.address || 'Rua Exemplo, 123 - Centro - Cidade/UF')
                                            .replace(/{{telefone}}/g, settings.phone || '(11) 98765-4321')
                                            .replace(/{{email}}/g, settings.email || 'contato@mercadodovale.com.br')
                                            .replace(/{{nome_documento}}/g, 'GARANTIA ESTENDIDA');

                                        return template
                                            .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
                                            .replace(/{{logo}}/g, logoHtml)
                                            .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
                                            .replace(/{{nome_cliente}}/g, 'João da Silva')
                                            .replace(/{{cpf_cliente}}/g, '123.456.789-00')
                                            .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
                                            .replace(/{{produto}}/g, 'iPhone 13 128GB')
                                            .replace(/{{imei1}}/g, '123456789012345')
                                            .replace(/{{imei2}}/g, '')
                                            .replace(/{{meses_garantia_estendida}}/g, '12')
                                            .replace(/{{valor_garantia_estendida}}/g, 'R$ 150,00')
                                            .replace(/{{data_inicio_estendida}}/g, '15/03/2026')
                                            .replace(/{{data_fim_estendida}}/g, '15/03/2027');
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tags_dictionary' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <Tag className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">Dicionário Global de Tags</h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Utilize estas tags na edição de "Garantia", "Garantia Estendida", "Quitação" e "Folha Extra". Clique num bloco para copiar.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {Object.entries(GLOBAL_DOCUMENT_TAGS).map(([tag, description]) => (
                                <button
                                    key={tag}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`{{${tag}}}`);
                                        toast.success(`Tag {{${tag}}} copiada!`);
                                    }}
                                    className="flex flex-col items-start p-3 bg-white hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-lg transition-all text-left group shadow-sm"
                                >
                                    <div className="flex items-center justify-between w-full mb-1">
                                        <span className="font-mono text-sm font-bold text-blue-600 break-all pr-2">
                                            {`{{${tag}}}`}
                                        </span>
                                        <Copy size={14} className="text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-2 mt-1 w-full" title={description}>
                                        {description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
