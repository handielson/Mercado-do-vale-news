import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Coins,
    Gift,
    Home,
    Mail,
    Phone,
    ShieldCheck,
    ShoppingBag,
    TrendingUp,
    User,
    WalletCards,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useVpsAuth } from '../../hooks/useVpsAuth';
import type { Customer } from '../../types/customer';
import { PersonalInfoTab } from '../../components/customer/profile/PersonalInfoTab';
import { PurchaseHistoryTab } from '../../components/customer/profile/PurchaseHistoryTab';
import { TypeUpgradeTab } from '../../components/customer/profile/TypeUpgradeTab';
import { BenefitsTab } from '../../components/customer/profile/BenefitsTab';
import { CoinsTab } from '../../components/customer/profile/CoinsTab';

type TabType = 'overview' | 'personal' | 'history' | 'upgrade' | 'coins' | 'benefits';

const getInitialTab = (location: ReturnType<typeof useLocation>): TabType => {
    const tabFromQuery = new URLSearchParams(location.search).get('tab');
    if (tabFromQuery === 'overview') return 'overview';
    if (tabFromQuery === 'history') return 'history';
    if (tabFromQuery === 'personal') return 'personal';
    if (tabFromQuery === 'benefits') return 'benefits';
    if (tabFromQuery === 'upgrade') return 'upgrade';
    if (tabFromQuery === 'coins') return 'coins';
    return (location.state as any)?.tab || 'overview';
};

const accountTypeLabel: Record<string, string> = {
    retail: 'Varejo',
    resale: 'Revenda',
    wholesale: 'Atacado',
    ADMIN: 'Administrador',
};

interface CustomerProfilePageProps {
    customerOverride?: Customer;
    isAdminPreview?: boolean;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ customerOverride, isAdminPreview = false }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { customer, isLoading } = useVpsAuth();
    const effectiveCustomer = customerOverride || customer;
    const [activeTab, setActiveTab] = useState<TabType>(() => getInitialTab(location));

    useEffect(() => {
        setActiveTab(getInitialTab(location));
    }, [location]);

    const profileCompletion = useMemo(() => {
        if (!effectiveCustomer) return { total: 0, done: 0, percent: 0, missing: [] as string[] };

        const checks = [
            { label: 'Nome', done: Boolean(effectiveCustomer.name) },
            { label: 'E-mail', done: Boolean(effectiveCustomer.email) },
            { label: 'Telefone', done: Boolean(effectiveCustomer.phone) },
            { label: 'CPF/CNPJ', done: Boolean(effectiveCustomer.cpf_cnpj) },
            { label: 'Nascimento', done: Boolean(effectiveCustomer.birth_date) },
            { label: 'Endereco', done: Boolean(effectiveCustomer.address?.street && effectiveCustomer.address?.city) },
        ];
        const done = checks.filter((item) => item.done).length;
        return {
            total: checks.length,
            done,
            percent: Math.round((done / checks.length) * 100),
            missing: checks.filter((item) => !item.done).map((item) => item.label),
        };
    }, [effectiveCustomer]);

    if (isLoading && !customerOverride) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                    <p className="mt-4 text-sm font-medium text-slate-600">Carregando sua area...</p>
                </div>
            </div>
        );
    }

    if (!effectiveCustomer) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <AlertCircle className="mx-auto h-9 w-9 text-blue-600" />
                    <p className="mt-4 text-sm font-medium text-slate-700">Voce precisa estar logado para acessar esta pagina.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview' as TabType, label: 'Visao geral', icon: Home },
        { id: 'personal' as TabType, label: 'Meus Dados', icon: User },
        { id: 'history' as TabType, label: 'Historico', icon: ShoppingBag },
        { id: 'benefits' as TabType, label: 'Beneficios', icon: ShieldCheck },
        { id: 'upgrade' as TabType, label: 'Tipo de Conta', icon: TrendingUp },
        { id: 'coins' as TabType, label: 'Moedas', icon: Coins },
    ];

    const accountLabel = accountTypeLabel[effectiveCustomer.customer_type || 'retail'] || 'Varejo';
    const firstName = effectiveCustomer.name?.split(' ')?.[0] || 'cliente';
    const memberSince = effectiveCustomer.created_at ? new Date(effectiveCustomer.created_at).toLocaleDateString('pt-BR') : 'cadastro recente';

    const overviewCards = [
        {
            label: 'Tipo de conta',
            value: accountLabel,
            detail: effectiveCustomer.account_status === 'pending' ? 'Ativacao pendente' : 'Conta ativa',
            icon: TrendingUp,
            tone: 'blue',
        },
        {
            label: 'Cadastro',
            value: `${profileCompletion.percent}%`,
            detail: `${profileCompletion.done} de ${profileCompletion.total} campos completos`,
            icon: CheckCircle2,
            tone: 'emerald',
        },
        {
            label: 'Moedas do Vale',
            value: effectiveCustomer.referral_code || 'Ativo',
            detail: effectiveCustomer.referral_code ? 'Codigo de indicacao' : 'Programa habilitado',
            icon: Coins,
            tone: 'amber',
        },
    ];

    const quickActions = [
        {
            label: 'Continuar comprando',
            detail: 'Voltar para a vitrine',
            icon: ShoppingBag,
            onClick: () => navigate('/'),
        },
        {
            label: 'Ver meus pedidos',
            detail: 'Historico e comprovantes',
            icon: WalletCards,
            onClick: () => setActiveTab('history'),
        },
        {
            label: 'Completar cadastro',
            detail: profileCompletion.missing.length ? profileCompletion.missing.slice(0, 2).join(', ') : 'Tudo certo',
            icon: User,
            onClick: () => setActiveTab('personal'),
        },
        {
            label: 'Usar beneficios',
            detail: 'Peliculas, vantagens e regras',
            icon: Gift,
            onClick: () => setActiveTab('benefits'),
        },
    ];

    const renderOverview = () => (
        <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
                {overviewCards.map((card) => {
                    const Icon = card.icon;
                    const toneClass = card.tone === 'emerald'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : card.tone === 'amber'
                            ? 'bg-amber-50 text-amber-700 ring-amber-100'
                            : 'bg-blue-50 text-blue-700 ring-blue-100';
                    return (
                        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-800">{card.value}</p>
                            <p className="mt-1 text-sm text-slate-500">{card.detail}</p>
                        </div>
                    );
                })}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Resumo da conta</h2>
                            <p className="mt-1 text-sm text-slate-500">Dados essenciais para compras, beneficios e entregas.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('personal')}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            Atualizar dados
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-4">
                            <Mail className="mb-2 h-4 w-4 text-slate-400" />
                            <p className="text-xs font-semibold uppercase text-slate-500">E-mail</p>
                            <p className="mt-1 truncate text-sm font-medium text-slate-800">{effectiveCustomer.email || 'Nao informado'}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                            <Phone className="mb-2 h-4 w-4 text-slate-400" />
                            <p className="text-xs font-semibold uppercase text-slate-500">Telefone</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{effectiveCustomer.phone || 'Nao informado'}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700">Progresso do cadastro</p>
                            <span className="text-sm font-semibold text-blue-700">{profileCompletion.percent}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-blue-600 transition-all"
                                style={{ width: `${profileCompletion.percent}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            {profileCompletion.missing.length
                                ? `Pendencias: ${profileCompletion.missing.join(', ')}.`
                                : 'Cadastro completo para compras e beneficios.'}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800">Acoes rapidas</h2>
                    <div className="mt-4 space-y-2">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={action.label}
                                    type="button"
                                    onClick={action.onClick}
                                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
                                        <span className="block truncate text-xs text-slate-500">{action.detail}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );

    const renderAdminPersonalInfo = () => (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Nome</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{effectiveCustomer.name || 'Nao informado'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">CPF/CNPJ</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{effectiveCustomer.cpf_cnpj || 'Nao informado'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">E-mail</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{effectiveCustomer.email || 'Nao informado'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Telefone</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{effectiveCustomer.phone || 'Nao informado'}</p>
                </div>
            </div>
            <Link
                to={`/admin/customers/${effectiveCustomer.id}/edit`}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
                Corrigir cadastro
            </Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f6f8fb]">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar a loja
                </button>

                {isAdminPreview && (
                    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <span className="font-semibold">Visualizacao do admin:</span> voce esta vendo esta pagina como o cliente ve. Use esta tela para conferir historico, beneficios e dados antes de corrigir o cadastro.
                    </div>
                )}

                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-semibold text-white shadow-sm">
                                {firstName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-blue-700">Painel do Cliente</p>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
                                    Ola, {firstName}
                                </h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    Membro desde {memberSince}. Acompanhe pedidos, moedas, beneficios e dados em um so lugar.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
                            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase text-blue-700">Conta</p>
                                <p className="text-sm font-semibold text-slate-800">{accountLabel}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase text-emerald-700">Cadastro</p>
                                <p className="text-sm font-semibold text-slate-800">{profileCompletion.percent}% completo</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:flex-col lg:overflow-visible">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition lg:min-w-0 ${isActive
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                            }`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    <main className="min-w-0">
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab !== 'overview' && (
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
                                {activeTab === 'personal' && (isAdminPreview ? renderAdminPersonalInfo() : <PersonalInfoTab />)}
                                {activeTab === 'history' && <PurchaseHistoryTab customerOverride={effectiveCustomer} />}
                                {activeTab === 'benefits' && <BenefitsTab />}
                                {activeTab === 'upgrade' && <TypeUpgradeTab />}
                                {activeTab === 'coins' && <CoinsTab />}
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};
