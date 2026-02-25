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
        <div className="bg-slate-50 min-h-screen pb-12">

            {/* Premium Hero Header */}
            <div className="bg-gradient-to-br from-blue-900 via-slate-800 to-slate-900 pt-16 pb-28 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <button
                        onClick={() => navigate('/promocoes')}
                        className="flex items-center gap-2 text-blue-200/70 hover:text-white transition-colors mb-8 text-sm font-medium"
                    >
                        <ArrowLeft size={16} />
                        Voltar para Promoções
                    </button>

                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-blue-400/20 shadow-xl shadow-blue-900/50">
                            <Shield className="text-blue-300 w-10 h-10" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-3">
                                <CheckCircle2 size={12} className="text-blue-400" /> Cobertura Imediata
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                                Garantia Estendida
                            </h1>
                            <p className="text-lg text-blue-100/80 max-w-2xl font-medium leading-relaxed">
                                Leve seu aparelho com tranquilidade absoluta. Nossa cobertura extra protege seu investimento contra os imprevistos do dia a dia.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-20">

                {/* Pricing Cards Section */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-8 mb-8 backdrop-blur-xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <CheckCircle2 className="text-blue-500" size={24} />
                        Planos Disponíveis na Loja
                    </h2>

                    {activeOptions.length > 0 ? (
                        <div className="space-y-6">
                            <p className="text-slate-600 mb-2">
                                Estes são os prazos adicionais que você pode solicitar ao nosso vendedor ou via WhatsApp. O valor exato (R$) é calculado automaticamente na simulação em cima do preço do aparelho.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {activeOptions.sort((a, b) => a.months - b.months).map((opt, idx) => (
                                    <div key={idx} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-lg hover:border-blue-300 hover:-translate-y-1 group flex flex-col justify-between h-full">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Shield className="w-20 h-20 text-blue-600" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Proteção Premium</span>
                                            <div className="flex items-baseline gap-1 mb-4">
                                                <span className="text-4xl font-black text-slate-800 tracking-tight">+{opt.months}</span>
                                                <span className="text-lg font-bold text-slate-500">Meses</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                                            <p className="text-xs font-medium text-slate-500 mb-1">Taxa fixa sobre o produto</p>
                                            <p className="text-lg font-bold text-blue-600">{opt.percentage}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex gap-3 text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                                <p className="text-sm leading-relaxed font-medium">
                                    <strong>Como contratar:</strong> Escolha seu produto no catálogo, clique em comprar e adicione a garantia diretamente no simulador antes de enviar o orçamento pro WhatsApp.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                            <p className="text-sm font-medium">Os planos de garantia estendida estão passando por reformulação. Consulte nossa equipe!</p>
                        </div>
                    )}
                </div>

                {/* Contract/Terms Section */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
                    {/* Top Contract Bar */}
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-700">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <span className="font-semibold text-sm uppercase tracking-wide">Termos & Condições de Cobertura</span>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                        </div>
                    </div>

                    <div className="p-6 md:p-10">
                        {settings?.extended_warranty_terms_text ? (
                            <div
                                className="prose prose-slate max-w-none 
                                    prose-h2:text-2xl prose-h2:font-extrabold prose-h2:text-slate-800 prose-h2:mt-8 prose-h2:mb-4
                                    prose-h3:text-lg prose-h3:font-bold prose-h3:text-slate-800 prose-h3:mt-6
                                    prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-5
                                    prose-ul:list-disc prose-ul:pl-5 prose-ul:text-slate-600 prose-ul:mb-5
                                    prose-li:mb-2 prose-li:leading-relaxed
                                    prose-b:text-slate-800 prose-strong:text-slate-800
                                    marker:text-blue-500"
                                dangerouslySetInnerHTML={{ __html: settings.extended_warranty_terms_text }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <FileText className="w-16 h-16 mb-4 text-slate-300" />
                                <p className="font-medium text-lg">O regulamento completo será atualizado em breve.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
