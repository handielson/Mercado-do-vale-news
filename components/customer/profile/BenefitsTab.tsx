import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    Gift,
    History,
    MapPin,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { benefitService, BenefitStatus } from '../../../services/benefitService';
import { useVpsAuth } from '../../../hooks/useVpsAuth';

export const BenefitsTab: React.FC = () => {
    const { customer } = useVpsAuth();
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

    const benefitsSummary = useMemo(() => {
        return benefits.reduce(
            (acc, item) => {
                acc.active += item.monthsRemaining > 0 ? 1 : 0;
                acc.availableNow += item.canRedeemThisMonth ? 1 : 0;
                acc.remaining += item.monthsRemaining;
                acc.used += item.redemptions.length;
                return acc;
            },
            { active: 0, availableNow: 0, remaining: 0, used: 0 }
        );
    }, [benefits]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                <p className="mt-4 text-sm text-slate-500">Carregando seus beneficios...</p>
            </div>
        );
    }

    if (benefits.length === 0) {
        return (
            <div className="space-y-6">
                <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-blue-700">Central de beneficios</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">Meus Beneficios</h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">
                        Aqui ficam beneficios como pelicula gratis, regras de uso e historico de resgates.
                    </p>
                </header>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" />
                    <h3 className="mt-4 text-lg font-bold text-slate-800">Nenhum beneficio ativo</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                        Quando um beneficio for liberado para sua conta, ele aparecera aqui com status, validade e extrato.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-700">Central de beneficios</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Meus Beneficios</h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-500">
                            Acompanhe beneficios ativos, disponibilidade do mes, validade e historico de uso.
                        </p>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 ring-1 ring-blue-100">
                        <Sparkles className="h-4 w-4" />
                        Programa de protecao
                    </div>
                </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-bold uppercase text-slate-500">Beneficios ativos</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{benefitsSummary.active}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-700">Disponiveis agora</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{benefitsSummary.availableNow}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                    <p className="text-xs font-bold uppercase text-blue-700">Meses restantes</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{benefitsSummary.remaining}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase text-amber-700">Resgates usados</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{benefitsSummary.used}</p>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                    {benefits.map((item) => {
                        const grantedAt = new Date(item.benefit.granted_at).toLocaleDateString('pt-BR');
                        const expiresAt = item.benefit.expires_at
                            ? new Date(item.benefit.expires_at).toLocaleDateString('pt-BR')
                            : 'Sem data definida';
                        const progress = Math.max(0, Math.min(100, ((12 - item.monthsRemaining) / 12) * 100));

                        return (
                            <article key={item.benefit.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Beneficio ativo
                                            </div>
                                            <h3 className="mt-3 text-xl font-black text-slate-950">1 Ano de Pelicula Gratis</h3>
                                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    Adquirido: {grantedAt}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Valido ate: {expiresAt}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-center text-white">
                                            <span className="block text-3xl font-black">{item.monthsRemaining}/12</span>
                                            <span className="mt-1 block text-xs font-bold uppercase text-white/70">restantes</span>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                                            <span>Uso do beneficio</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                                    <div className={`rounded-xl border p-4 ${item.canRedeemThisMonth
                                        ? 'border-emerald-200 bg-emerald-50'
                                        : item.monthsRemaining === 0
                                            ? 'border-slate-200 bg-slate-50'
                                            : 'border-amber-200 bg-amber-50'
                                        }`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`rounded-xl p-2 ${item.canRedeemThisMonth
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : item.monthsRemaining === 0
                                                    ? 'bg-slate-200 text-slate-500'
                                                    : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {item.canRedeemThisMonth ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase text-slate-500">Status deste mes</p>
                                                <h4 className="mt-1 text-base font-black text-slate-900">
                                                    {item.canRedeemThisMonth
                                                        ? 'Pelicula disponivel'
                                                        : item.monthsRemaining === 0
                                                            ? 'Beneficio concluido'
                                                            : 'Cota do mes utilizada'}
                                                </h4>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {item.canRedeemThisMonth
                                                        ? 'Va ate a loja e solicite a instalacao gratuita deste mes.'
                                                        : item.monthsRemaining === 0
                                                            ? 'Todos os meses foram usados ou a validade terminou.'
                                                            : 'Aguarde o proximo mes para resgatar novamente.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-bold uppercase text-slate-500">Solicitar na loja</p>
                                        <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                                            <MapPin className="mt-0.5 h-4 w-4 text-blue-600" />
                                            Leve o aparelho para atendimento e informe que deseja usar o beneficio de pelicula.
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 bg-slate-50 p-5">
                                    <div className="mb-4 flex items-center gap-2">
                                        <History className="h-4 w-4 text-slate-500" />
                                        <h4 className="text-sm font-black uppercase text-slate-700">Extrato de resgates</h4>
                                    </div>

                                    {item.redemptions.length > 0 ? (
                                        <div className="space-y-2">
                                            {item.redemptions.map((redemption, index) => (
                                                <div key={redemption.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-blue-700">
                                                            {item.redemptions.length - index}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">Instalacao na loja ({redemption.year_month})</p>
                                                            <p className="text-xs text-slate-500">
                                                                Realizado em {new Date(redemption.redeemed_at).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                                        {redemption.redeemed_by_user?.name || 'Sistema'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                                            Nenhum resgate registrado ainda.
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Gift className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-950">Como usar</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <p>1. Confira se o status do mes esta disponivel.</p>
                        <p>2. Va ate a loja com o aparelho.</p>
                        <p>3. Solicite a pelicula gratuita no atendimento.</p>
                        <p>4. O resgate entra no extrato apos a confirmacao.</p>
                    </div>
                </aside>
            </section>
        </div>
    );
};
