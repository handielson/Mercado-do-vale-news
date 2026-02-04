import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Save, Loader2, Receipt, Shield } from 'lucide-react';
import { companySettingsService } from '../../../services/companySettingsService';
import { CompanySettings, CompanySettingsInput } from '../../../types/companySettings';
import { WarrantyTemplateEditor } from '../../../components/settings/WarrantyTemplateEditor';
import { toast } from 'sonner';

type TabType = 'receipt' | 'warranty';

export default function DocumentSettingsPage() {
    const navigate = useNavigate();
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
        warranty_show_address: true
    });

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await companySettingsService.get();

            if (data) {
                setSettings({
                    company_name: data.company_name,
                    header_text: data.header_text || '',
                    footer_text: data.footer_text || '',
                    warranty_terms: data.warranty_terms || '',
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
                    warranty_show_address: data.warranty_show_address
                });
            } else {
                // Use defaults
                const defaults = companySettingsService.getDefaults();
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

                    {/* Tabs */}
                    <div className="flex gap-2 mt-4 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('receipt')}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'receipt'
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <Receipt size={18} />
                            Recibo
                        </button>
                        <button
                            onClick={() => setActiveTab('warranty')}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'warranty'
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <Shield size={18} />
                            Garantia
                        </button>
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
                                        onChange={(e) => handleChange('receipt_width', e.target.value as '58mm' | '80mm')}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="58mm">58mm (Impressora Térmica Pequena)</option>
                                        <option value="80mm">80mm (Impressora Térmica Padrão)</option>
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

                {activeTab === 'warranty' && (
                    <WarrantyTemplateEditor
                        template={settings.warranty_template || ''}
                        onTemplateChange={(value) => handleChange('warranty_template', value)}
                        logoUrl={settings.receipt_logo_url || ''}
                        showLogo={settings.warranty_show_logo || false}
                        showCompanyName={settings.warranty_show_company_name || false}
                        showCnpj={settings.warranty_show_cnpj || false}
                        showPhone={settings.warranty_show_phone || false}
                        showEmail={settings.warranty_show_email || false}
                        showAddress={settings.warranty_show_address || false}
                        onToggle={handleChange}
                    />
                )}
            </div>
        </div>
    );
}
