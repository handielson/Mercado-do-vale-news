import React, { useState, useEffect } from 'react';
import { Store, Save, ExternalLink, RefreshCw, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCompanyData, saveCompanyData } from '../../../services/companyService';
import { supabase } from '../../../services/supabase';
import { Company } from '../../../types/company';

export default function ShopeePage() {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shopeeConnected, setShopeeConnected] = useState(false);
    const [shopeeShopId, setShopeeShopId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const data = await getCompanyData();
            setCompany(data);
            // Busca o status OAuth do Shopee diretamente do Supabase
            // (VPS pode ter dados desatualizados sem o access_token)
            const { data: sbSettings } = await supabase
                .from('company_settings')
                .select('shopee_access_token, shopee_shop_id')
                .limit(1)
                .single();
            if (sbSettings?.shopee_access_token) {
                setShopeeConnected(true);
                setShopeeShopId(sbSettings.shopee_shop_id);
            }
        } catch (err: any) {
            toast.error('Erro ao buscar configurações.');
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async () => {
        if (!company) return;
        try {
            setSaving(true);
            await saveCompanyData(company);
            toast.success('Configurações da Shopee salvas!');
        } catch (err: any) {
            toast.error('Erro ao salvar as configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleOAuthLogin = async () => {
        if (!company?.shopee_partner_id || !company?.shopee_partner_key) {
            toast.error('Preencha o Partner ID e a Partner Key antes de tentar autenticar.');
            return;
        }
        
        try {
            toast.loading('Gerando link de integração...', { id: 'shopee-auth' });
            const res = await fetch('/api/shopee?action=auth');
            const data = await res.json();
            
            if (res.ok && data.url) {
                toast.success('Redirecionando para a Shopee...', { id: 'shopee-auth' });
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Erro ao gerar URL de autorização.', { id: 'shopee-auth' });
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro de conexão ao tentar autorizar.', { id: 'shopee-auth' });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    const isConnected = shopeeConnected;

    return (
        <div className="animate-in fade-in duration-500 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Store className="w-8 h-8 text-orange-500" />
                        Shopee Integration
                    </h1>
                    <p className="text-slate-500 mt-1">Conecte sua loja na Shopee Open Platform via OAuth 2.0</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    Salvar Chaves
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-slate-500" />
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Credenciais do Custom App</h2>
                            <p className="text-xs text-slate-500">Crie um app na Shopee Open Platform e copie as chaves abaixo.</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Partner ID</label>
                            <input
                                type="text"
                                value={company?.shopee_partner_id || ''}
                                onChange={(e) => company && setCompany({ ...company, shopee_partner_id: e.target.value })}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                placeholder="Ex: 1229870"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Partner Key</label>
                            <input
                                type="password"
                                value={company?.shopee_partner_key || ''}
                                onChange={(e) => company && setCompany({ ...company, shopee_partner_key: e.target.value })}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-orange-500 bg-white font-mono text-sm"
                                placeholder="Ex: shpk..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Ambiente de Sandbox (Testes) configurado automaticamente se o Partner ID do Sandbox for usado.
                        </div>
                        <a href="https://open.shopee.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1">
                            Acessar Console <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-slate-500" />
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Autorização OAuth 2.0</h2>
                            <p className="text-xs text-slate-500">Vincule a sua conta de Vendedor (Shop) ao nosso App.</p>
                        </div>
                    </div>
                    {isConnected ? (
                        <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase tracking-wider">
                            Conectado
                        </div>
                    ) : (
                        <div className="px-3 py-1 bg-slate-200 text-slate-500 text-xs font-bold rounded-full border border-slate-300 uppercase tracking-wider">
                            Desconectado
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-4">
                    {isConnected ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-green-800">Autenticação Ativa</p>
                                <p className="text-xs text-green-700 mt-1">Shop ID: <span className="font-mono bg-white px-2 py-0.5 rounded border border-green-200">{shopeeShopId}</span></p>
                            </div>
                            <button
                                onClick={handleOAuthLogin}
                                className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reconectar / Atualizar Token
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                                <Store className="w-8 h-8 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Conecte sua Loja</h3>
                                <p className="text-sm text-slate-500 mx-auto max-w-sm mt-1">Para sincronizar produtos, você precisa autorizar este sistema a acessar a sua conta da Shopee.</p>
                            </div>
                            <button
                                onClick={handleOAuthLogin}
                                className="mt-2 bg-[#ee4d2d] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#d73f21] transition-colors shadow-md shadow-orange-500/20"
                            >
                                Autorizar com a Shopee
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
