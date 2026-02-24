import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { companySettingsService } from '../../services/companySettingsService';
import { CompanySettings, WarrantyOption } from '../../types/companySettings';

export default function ExtendedWarrantyPage() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await companySettingsService.get();
            setSettings(data);
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const activeOptions = settings?.extended_warranty_options?.filter(o => o.active) || [];

    return (
        <div className="bg-slate-50 min-h-screen py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium"
                    >
                        <ArrowLeft size={16} />
                        Voltar para a Loja
                    </button>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Shield className="text-blue-600" size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">
                                Garantia Estendida
                            </h1>
                            <p className="text-slate-600 mt-1">
                                Proteção total e tranquilidade para o seu novo aparelho.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Conteúdo Principal (Regulamento) */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 sm:p-8">
                                {settings?.extended_warranty_terms_text ? (
                                    <div
                                        className="prose prose-slate max-w-none 
                                            prose-h2:text-xl prose-h2:font-bold prose-h2:text-slate-800 prose-h2:mt-6 prose-h2:mb-4
                                            prose-h3:text-lg prose-h3:font-semibold prose-h3:text-slate-800
                                            prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-4
                                            prose-ul:list-disc prose-ul:pl-5 prose-ul:text-slate-600 prose-ul:mb-4
                                            prose-li:mb-2
                                            prose-b:text-slate-800 prose-strong:text-slate-800"
                                        dangerouslySetInnerHTML={{ __html: settings.extended_warranty_terms_text }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                        <FileText className="w-12 h-12 mb-4 text-slate-400 opacity-50" />
                                        <p>O regulamento da garantia estendida está sendo atualizado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar (Planos) */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-green-500" size={20} />
                                Planos Disponíveis
                            </h3>

                            {activeOptions.length > 0 ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600 mb-4">
                                        Estes são os prazos adicionais que você pode contratar no ato da compra. O valor é calculado conforme o preço do aparelho escolhido.
                                    </p>

                                    {activeOptions.sort((a, b) => a.months - b.months).map((opt, idx) => (
                                        <div key={idx} className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 transition-all hover:shadow-md hover:border-blue-200">
                                            <div className="flex justify-between items-end mb-2">
                                                <div>
                                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">Proteção Extra</span>
                                                    <span className="text-2xl font-black text-slate-800">+{opt.months} Meses</span>
                                                </div>
                                            </div>
                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 mt-3 border border-blue-50/50">
                                                <p className="text-xs text-slate-600 flex justify-between items-center">
                                                    <span>Taxa sobre o produto:</span>
                                                    <strong className="text-blue-700">{opt.percentage}%</strong>
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <div className="flex gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                            <AlertCircle className="flex-shrink-0" size={20} />
                                            <p className="text-xs leading-relaxed font-medium">
                                                Você pode adicionar a Garantia Estendida diretamente pelo WhatsApp ao solicitar seu orçamento ou na loja física no momento do faturamento.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                                    <p className="text-sm">Os planos de garantia estendida estão passando por reformulação. Consulte nossa equipe!</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
