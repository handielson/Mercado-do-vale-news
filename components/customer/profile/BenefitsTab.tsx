import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, Clock, AlertCircle } from 'lucide-react';
import { benefitService, BenefitStatus } from '../../../services/benefitService';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';

export const BenefitsTab: React.FC = () => {
    const { customer } = useSupabaseAuth();
    const [benefits, setBenefits] = useState<BenefitStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (customer) {
            loadBenefits(customer.id);
        }
    }, [customer]);

    const loadBenefits = async (customerId: string) => {
        try {
            setLoading(true);
            const data = await benefitService.getCustomerBenefitsStatus(customerId);
            setBenefits(data);
        } catch (error) {
            console.error('Error loading benefits:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 text-sm">Carregando seus benefícios...</p>
            </div>
        );
    }

    if (benefits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50 border border-slate-200 rounded-xl">
                <ShieldCheck size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhum benefício ativo</h3>
                <p className="text-slate-500 mt-2 max-w-sm text-sm">
                    Você ainda não possui benefícios ativos como o programa de 1 Ano de Película Grátis.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" size={24} />
                    Meus Benefícios
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Acompanhe seus benefícios ativos e o histórico de utilização.
                </p>
            </div>

            <div className="space-y-6">
                {benefits.map((b) => (
                    <div key={b.benefit.id} className="border border-blue-200 bg-white shadow-sm overflow-hidden rounded-2xl">
                        {/* Header do Card */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black">1 Ano de Película Grátis</h3>
                                <div className="flex items-center gap-4 mt-2 text-blue-100 text-sm">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} /> Adquirido: {new Date(b.benefit.granted_at).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} /> Expira: {b.benefit.expires_at ? new Date(b.benefit.expires_at).toLocaleDateString('pt-BR') : '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-center">
                                <span className="block text-2xl font-black">{b.monthsRemaining}/12</span>
                                <span className="block text-[10px] uppercase tracking-wider font-bold opacity-80 mt-0.5">Disponíveis</span>
                            </div>
                        </div>

                        {/* Status de Resgate Atual */}
                        <div className="p-6 border-b border-slate-100">
                            {b.canRedeemThisMonth ? (
                                <div className="flex items-center justify-between bg-green-50 border border-green-200 p-4 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-full text-green-600">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-green-800">Película deste mês disponível!</h4>
                                            <p className="text-xs text-green-700 mt-0.5">Vá até nossa loja e solicite a instalação gratuita.</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold px-3 py-1 bg-green-200 text-green-800 rounded-full uppercase tracking-wider">Mês {13 - b.monthsRemaining}</span>
                                </div>
                            ) : b.monthsRemaining === 0 ? (
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl opacity-70">
                                    <AlertCircle className="text-slate-400" size={24} />
                                    <div>
                                        <h4 className="font-bold text-slate-700">Benefício Expirado ou Concluído</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Todos os 12 meses já foram utilizados ou validade expirou.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                                    <Calendar className="text-amber-500" size={24} />
                                    <div>
                                        <h4 className="font-bold text-amber-800">Cota do mês já utilizada</h4>
                                        <p className="text-xs text-amber-700 mt-0.5">Aguarde o próximo mês para resgatar sua nova película gratuita.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Histórico */}
                        {b.redemptions.length > 0 && (
                            <div className="p-6 bg-slate-50">
                                <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <Calendar size={16} /> Extrato de Resgates
                                </h4>
                                <div className="space-y-3">
                                    {b.redemptions.map((r, index) => (
                                        <div key={r.id} className="flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                                    {b.redemptions.length - index}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">
                                                        Instalação na Loja <span className="text-slate-400 font-normal">({r.year_month})</span>
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Realizado em {new Date(r.redeemed_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                Confirmado por: {r.redeemed_by_user?.name || 'Sistema'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
