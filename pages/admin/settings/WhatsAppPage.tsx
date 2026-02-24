import React, { useState, useEffect } from 'react';
import { MessageCircle, Save, CheckCircle, AlertCircle, Phone, Link2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getWhatsAppSettings, updateWhatsAppSettings } from '../../../services/whatsappSettingsService';
import { WhatsAppSettings } from '../../../types/whatsapp';
import toast from 'react-hot-toast';

export default function WhatsAppPage() {
    const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await getWhatsAppSettings();
            if (data) {
                setSettings(data);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            toast.error('Erro ao carregar configurações do WhatsApp');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        setIsSaving(true);
        try {
            await updateWhatsAppSettings(settings);
            toast.success('Configurações salvas com sucesso!');
            await loadSettings();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar configurações do WhatsApp');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                    <MessageCircle className="text-emerald-500" size={32} />
                    Integração WhatsApp
                </h2>
                <p className="text-slate-500 mt-2">
                    Conecte o sistema à Evolution API para disparos e atendimentos via WhatsApp.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Servidor Evolution API</h3>
                            <p className="text-sm text-slate-500">Credenciais geradas no Easypanel</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-600">Status da Integração:</span>
                            <button
                                onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span className={`text-sm font-medium ${settings.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {settings.is_active ? 'Ativado' : 'Desativado'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Link2 size={16} /> URL da API
                            </label>
                            <input
                                type="url"
                                value={settings.api_url}
                                onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                                placeholder="ex: https://whatsapp-bot-api.host"
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">Insira a URL pública gerada para a sua Evolution API.</p>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <ShieldAlert size={16} /> Global API Key (AUTHENTICATION_API_KEY)
                            </label>
                            <input
                                type="password"
                                value={settings.api_key}
                                onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                                placeholder="Cole a chave aqui. Ex: 429683C4C977415CAAFCCE10F7D557E11"
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono"
                            />
                            <p className="text-xs text-slate-500 mt-1">A chave de segurança global extraída da variável do container.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <MessageCircle size={16} /> Nome da Instância (Session)
                            </label>
                            <input
                                type="text"
                                value={settings.instance_name}
                                onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })}
                                placeholder="ex: suporte-principal"
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">Nome identificador da sessão criada no WhatsApp.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Phone size={16} /> Número Vinculado (Opcional)
                            </label>
                            <input
                                type="text"
                                value={settings.phone_number || ''}
                                onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                                placeholder="ex: 5511999999999"
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">O número do WhatsApp atualmente conectado ao bot.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save size={18} />
                        )}
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}
