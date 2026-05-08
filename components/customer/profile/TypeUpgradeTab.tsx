import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Loader2,
    Store,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import type { TypeUpgradeRequest } from '../../../types/typeUpgradeRequest';

type UpgradeType = 'wholesale' | 'resale';

const accountPlans = [
    {
        id: 'retail',
        label: 'Varejo',
        description: 'Conta padrao para compras individuais.',
        perks: ['Acesso ao catalogo', 'Moedas do Vale', 'Beneficios ativos'],
        icon: Store,
        className: 'bg-blue-50 text-blue-700 ring-blue-100',
    },
    {
        id: 'wholesale',
        label: 'Atacado',
        description: 'Precos especiais para compras em quantidade.',
        perks: ['Condicoes para volume', 'Atendimento comercial', 'Analise em ate 48 horas'],
        icon: TrendingUp,
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    {
        id: 'resale',
        label: 'Revenda',
        description: 'Melhores condicoes para revendedores.',
        perks: ['Preco para revenda', 'Prioridade em oportunidades', 'Analise em ate 48 horas'],
        icon: Users,
        className: 'bg-violet-50 text-violet-700 ring-violet-100',
    },
] as const;

export const TypeUpgradeTab: React.FC = () => {
    const { customer, requestTypeUpgrade, getUpgradeRequestStatus } = useSupabaseAuth();
    const [upgradeRequest, setUpgradeRequest] = useState<TypeUpgradeRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<UpgradeType | null>(null);

    useEffect(() => {
        loadUpgradeRequest();
    }, []);

    const loadUpgradeRequest = async () => {
        setLoading(true);
        try {
            const request = await getUpgradeRequestStatus();
            setUpgradeRequest(request);
        } catch (error) {
            console.error('Error loading upgrade request:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestUpgrade = async (type: UpgradeType) => {
        setSubmitting(type);
        try {
            const request = await requestTypeUpgrade(type);
            setUpgradeRequest(request);
        } finally {
            setSubmitting(null);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'retail': return 'Varejo';
            case 'wholesale': return 'Atacado';
            case 'resale': return 'Revenda';
            default: return type;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const currentPlan = useMemo(() => {
        const currentType = customer?.customer_type || 'retail';
        return accountPlans.find((plan) => plan.id === currentType) || accountPlans[0];
    }, [customer?.customer_type]);

    const canRequestUpgrade = customer?.customer_type === 'retail' && (!upgradeRequest || upgradeRequest.status === 'rejected');
    const hasPendingRequest = upgradeRequest?.status === 'pending' && customer?.customer_type !== upgradeRequest.requested_type;
    const hasRejectedRequest = upgradeRequest?.status === 'rejected';
    const CurrentIcon = currentPlan.icon;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-700">Central de conta</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Tipo de Conta</h2>
                        <p className="mt-2 text-sm text-slate-500 lg:max-w-3xl">
                            Veja sua categoria atual e solicite acesso a condicoes comerciais de atacado ou revenda.
                        </p>
                    </div>
                    <div className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ring-1 ${currentPlan.className}`}>
                        <CurrentIcon className="h-4 w-4" />
                        Conta atual: {currentPlan.label}
                    </div>
                </div>
            </header>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase text-slate-500">Conta atual</p>
                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-950">{currentPlan.label}</h3>
                                <p className="mt-1 text-sm text-slate-500">{currentPlan.description}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {currentPlan.perks.map((perk) => (
                                        <span key={perk} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                            {perk}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${currentPlan.className}`}>
                                <CurrentIcon className="h-6 w-6" />
                            </div>
                        </div>
                    </div>

                    {hasPendingRequest && upgradeRequest && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                            <div className="flex items-start gap-3">
                                <Clock className="mt-0.5 h-5 w-5 text-blue-700" />
                                <div>
                                    <p className="text-sm font-black uppercase text-blue-800">Analise em andamento</p>
                                    <h3 className="mt-1 text-lg font-black text-slate-950">
                                        Solicitacao para {getTypeLabel(upgradeRequest.requested_type)}
                                    </h3>
                                    <p className="mt-1 text-sm text-blue-800">
                                        Nossa equipe esta avaliando seu pedido. O prazo estimado e de ate 48 horas.
                                    </p>
                                    <p className="mt-2 text-xs font-semibold text-blue-700">
                                        Solicitado em {formatDate(upgradeRequest.requested_at)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasRejectedRequest && upgradeRequest && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                            <div className="flex items-start gap-3">
                                <XCircle className="mt-0.5 h-5 w-5 text-red-700" />
                                <div>
                                    <p className="text-sm font-black uppercase text-red-800">Solicitacao rejeitada</p>
                                    <p className="mt-1 text-sm text-red-800">
                                        O pedido para {getTypeLabel(upgradeRequest.requested_type)} nao foi aprovado.
                                    </p>
                                    {upgradeRequest.rejection_reason && (
                                        <p className="mt-2 text-sm text-red-800">
                                            <strong>Motivo:</strong> {upgradeRequest.rejection_reason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <p className="text-xs font-bold uppercase text-slate-500">Planos disponiveis</p>
                            <h3 className="mt-1 text-lg font-black text-slate-950">Escolha uma solicitacao</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {accountPlans.filter((plan) => plan.id !== 'retail').map((plan) => {
                                const Icon = plan.icon;
                                const type = plan.id as UpgradeType;
                                const isCurrent = customer?.customer_type === plan.id;
                                const isSubmitting = submitting === type;

                                return (
                                    <article key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${plan.className}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h4 className="text-lg font-black text-slate-950">{plan.label}</h4>
                                        <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                                        <ul className="mt-4 space-y-2">
                                            {plan.perks.map((perk) => (
                                                <li key={perk} className="flex items-center gap-2 text-sm text-slate-600">
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    {perk}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            onClick={() => handleRequestUpgrade(type)}
                                            disabled={!canRequestUpgrade || isCurrent || Boolean(submitting)}
                                            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {plan.id === 'wholesale' ? 'Solicitar Atacado' : 'Solicitar Revenda'}
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-950">Como funciona</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <p>1. Escolha Atacado ou Revenda.</p>
                        <p>2. Envie a solicitacao para analise.</p>
                        <p>3. Nossa equipe responde em ate 48 horas.</p>
                        <p>4. Apos aprovado, os precos especiais aparecem automaticamente.</p>
                    </div>
                </aside>
            </section>
        </div>
    );
};
