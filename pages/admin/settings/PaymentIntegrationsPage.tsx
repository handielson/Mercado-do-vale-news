import React, { useState, useEffect } from 'react';
import { CreditCard, Save, Loader2, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { paymentIntegrationService } from '../../../services/paymentIntegrationService';
import type { PaymentIntegration, PaymentIntegrationInput, PaymentGatewayName } from '../../../types/paymentIntegration';
import { useTheme } from '../../../contexts/ThemeContext';

const GATEWAYS = [
    {
        id: 'mercado_pago' as PaymentGatewayName,
        name: 'Mercado Pago',
        description: 'Receba PIX e Cartões via Mercado Pago',
        color: 'bg-blue-600',
        textColor: 'text-blue-600',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        ratesUrl: 'https://www.mercadopago.com.br/costs-section'
    },
    {
        id: 'pagseguro' as PaymentGatewayName,
        name: 'PagSeguro',
        description: 'Venda com Cartão de Crédito, Boleto e PIX',
        color: 'bg-green-500',
        textColor: 'text-green-600',
        bgLight: 'bg-green-50',
        borderColor: 'border-green-200',
        ratesUrl: 'https://pagseguro.uol.com.br/taxas-e-tarifas.jhtml'
    },
    {
        id: 'stripe' as PaymentGatewayName,
        name: 'Stripe',
        description: 'Pagamentos internacionais e Cartões',
        color: 'bg-indigo-600',
        textColor: 'text-indigo-600',
        bgLight: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        ratesUrl: 'https://stripe.com/br/pricing'
    },
    {
        id: 'pagaleve' as PaymentGatewayName,
        name: 'PagaLeve',
        description: 'Pix Parcelado em 4x sem juros',
        color: 'bg-pink-600',
        textColor: 'text-pink-600',
        bgLight: 'bg-pink-50',
        borderColor: 'border-pink-200',
        ratesUrl: 'https://pagaleve.com.br'
    }
];

export default function PaymentIntegrationsPage() {
    const { settings: themeSettings } = useTheme();
    const [integrations, setIntegrations] = useState<Record<string, PaymentIntegration>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    // Form states
    const [expanded, setExpanded] = useState<string | null>(null);
    const [formData, setFormData] = useState<PaymentIntegrationInput | null>(null);

    useEffect(() => {
        loadIntegrations();
    }, []);

    const loadIntegrations = async () => {
        try {
            setLoading(true);
            const data = await paymentIntegrationService.getIntegrations();

            // Convert to Record
            const record: Record<string, PaymentIntegration> = {};
            data.forEach(item => {
                record[item.gateway_name] = item;
            });

            setIntegrations(record);
        } catch (error: any) {
            console.error('Error loading integrations:', error);
            toast.error('Erro ao buscar integrações: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = (gatewayId: PaymentGatewayName) => {
        if (expanded === gatewayId) {
            setExpanded(null);
            setFormData(null);
            return;
        }

        const existing = integrations[gatewayId];
        setExpanded(gatewayId);
        setFormData(existing ? {
            gateway_name: existing.gateway_name,
            is_active: existing.is_active,
            public_key: existing.public_key,
            access_token: existing.access_token,
            client_id: existing.client_id,
            client_secret: existing.client_secret,
            environment: existing.environment
        } : {
            gateway_name: gatewayId,
            is_active: false,
            environment: 'sandbox'
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expanded || !formData) return;

        try {
            setSaving(expanded);
            const saved = await paymentIntegrationService.upsertIntegration(formData);

            setIntegrations(prev => ({
                ...prev,
                [saved.gateway_name]: saved
            }));

            toast.success('Integração salva com sucesso!');
        } catch (error: any) {
            console.error('Error saving integration:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <CreditCard size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Integrações de Pagamento</h1>
                    <p className="text-slate-500">Configure as chaves de API dos gateways para vender online.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {GATEWAYS.map(gateway => {
                    const isConfigured = !!integrations[gateway.id];
                    const isActive = isConfigured && integrations[gateway.id]?.is_active;
                    const isExpanded = expanded === gateway.id;

                    return (
                        <div key={gateway.id} className={`bg-white rounded-xl border ${isExpanded ? gateway.borderColor : 'border-slate-200'} shadow-sm overflow-hidden transition-all duration-200`}>
                            {/* Header do Card */}
                            <div
                                className={`p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${isExpanded ? gateway.bgLight : ''}`}
                                onClick={() => handleExpand(gateway.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl ${gateway.color}`}>
                                        {gateway.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${isExpanded ? gateway.textColor : 'text-slate-800'}`}>
                                            {gateway.name}
                                        </h3>
                                        <p className="text-sm text-slate-500">{gateway.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isConfigured ? (
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {isActive ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {isActive ? 'Ativo' : 'Desativado'}
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-500 rounded-full">
                                            Não configurado
                                        </span>
                                    )}
                                    {gateway.ratesUrl && (
                                        <a
                                            href={gateway.ratesUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            Ver taxas
                                        </a>
                                    )}
                                    <span className={`text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {/* Corpo/Formulário do Card */}
                            {isExpanded && formData && (
                                <div className="p-6 border-t border-slate-100 bg-white">
                                    <form onSubmit={handleSave} className="space-y-4">
                                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <Key size={18} className="text-slate-400" />
                                                <h4 className="font-semibold text-slate-700">Credenciais API</h4>
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={formData.is_active}
                                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                    />
                                                    <div className={`block w-10 h-6 outline-none rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_active ? 'translate-x-4' : ''}`}></div>
                                                </div>
                                                <span className={`text-sm font-medium ${formData.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {formData.is_active ? 'Gateway Ativo' : 'Ativar Gateway'}
                                                </span>
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Ambiente de Operação
                                                </label>
                                                <select
                                                    value={formData.environment}
                                                    onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'production' | 'sandbox' })}
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    <option value="sandbox">Sandbox (Testes)</option>
                                                    <option value="production">Produção (Vendas Reais)</option>
                                                </select>
                                            </div>

                                            {gateway.id === 'mercado_pago' && (
                                                <>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Access Token <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="APP_USR-1234..."
                                                            value={formData.access_token || ''}
                                                            onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Public Key
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="APP_USR-5678..."
                                                            value={formData.public_key || ''}
                                                            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center justify-between gap-3">
                                                        <span>
                                                            <strong>💳 Quem paga as taxas?</strong> Configure se a taxa é absorvida pela loja ou repassada ao comprador.
                                                        </span>
                                                        <a
                                                            href="https://www.mercadopago.com.br/costs-section"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                                        >
                                                            <ExternalLink size={12} />
                                                            Configurar no MP
                                                        </a>
                                                    </div>
                                                </>
                                            )}


                                            {/* PagSeguro — campos específicos */}
                                            {gateway.id === 'pagseguro' && (
                                                <>
                                                    <div className="md:col-span-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                                        <strong>🔑 Onde encontrar:</strong> Acesse{' '}
                                                        <a href={formData.environment === 'sandbox' ? 'https://sandbox.pagseguro.uol.com.br' : 'https://pagseguro.uol.com.br'} target="_blank" rel="noopener noreferrer" className="underline">
                                                            {formData.environment === 'sandbox' ? 'sandbox.pagseguro.uol.com.br' : 'pagseguro.uol.com.br'}
                                                        </a>{' '}
                                                        → Minha conta → Preferências → Integrações.
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Email da Conta PagSeguro <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="email"
                                                            required
                                                            placeholder="seuemail@pagseguro.com.br"
                                                            value={formData.client_id || ''}
                                                            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Account Token (Token da Conta) <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Seu token de autorização (32-40 chars)"
                                                            value={formData.access_token || ''}
                                                            onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-500 outline-none"
                                                        />
                                                        <p className="text-xs text-slate-400 mt-1">Usado no servidor para criar sessões e cobranças</p>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Public Key (Chave Pública para SDK)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="Chave pública para tokenização de cartão (checkout transparente)"
                                                            value={formData.public_key || ''}
                                                            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-500 outline-none"
                                                        />
                                                        <p className="text-xs text-slate-400 mt-1">Opcional se usar apenas PIX. Necesário para Cartão Transparente.</p>
                                                    </div>
                                                </>
                                            )}

                                            {/* Outros gateways genéricos (Stripe, PagaLeve etc.) */}
                                            {gateway.id !== 'mercado_pago' && gateway.id !== 'pagseguro' && (
                                                <>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Secret Key / Access Token
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.access_token || ''}
                                                            onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Public Key / Client ID
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.public_key || ''}
                                                            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                                            <button
                                                type="submit"
                                                disabled={saving === gateway.id}
                                                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-colors ${saving === gateway.id ? 'bg-slate-400 cursor-not-allowed' : gateway.color + ' hover:opacity-90'}`}
                                            >
                                                {saving === gateway.id ? (
                                                    <><Loader2 size={18} className="animate-spin" /> Salvando...</>
                                                ) : (
                                                    <><Save size={18} /> Salvar Credenciais</>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
