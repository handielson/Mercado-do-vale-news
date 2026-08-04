import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock3,
    CloudCog,
    History,
    Laptop,
    MapPin,
    Megaphone,
    Loader2,
    RefreshCw,
    RotateCcw,
    ShieldCheck,
    WalletCards,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    marketingApprovalService,
    type MarketingApprovalDecision,
    type MarketingApprovalRequest,
    type MarketingApprovalStatus,
    type MarketingJson,
} from '../../../../services/marketingApprovalService';

type ApprovalFilter = MarketingApprovalStatus | 'all';

const STATUS_META: Record<MarketingApprovalStatus, { label: string; className: string }> = {
    pending: { label: 'Aguardando', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    approved: { label: 'Aprovada', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
    rejected: { label: 'Rejeitada', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
    executing: { label: 'Executando', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
    succeeded: { label: 'Concluída', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    failed: { label: 'Falhou', className: 'bg-red-50 text-red-700 ring-red-200' },
    cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    expired: { label: 'Expirada', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const FILTERS: Array<{ value: ApprovalFilter; label: string }> = [
    { value: 'pending', label: 'Pendentes' },
    { value: 'approved', label: 'Aprovadas' },
    { value: 'executing', label: 'Executando' },
    { value: 'succeeded', label: 'Concluídas' },
    { value: 'failed', label: 'Falhas' },
    { value: 'all', label: 'Todas' },
];

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
    }).format(date);
}

const FIELD_LABELS: Record<string, string> = {
    activeCampaigns: 'Campanhas ativas agora',
    campaigns: 'Campanhas que serão criadas',
    name: 'Nome da campanha',
    itemKey: 'Identificação',
    budgetType: 'Forma do orçamento',
    authorizedAmount: 'Valor autorizado',
    periodLimit: 'Limite para o período',
    durationDays: 'Duração prevista',
    externalCreation: 'Condições de criação',
    status: 'Situação inicial',
    budgetApplied: 'Orçamento aplicado agora',
    adSetsCreated: 'Conjuntos de anúncios criados',
    adsCreated: 'Anúncios criados',
    campaignsCreated: 'Campanhas criadas',
    metaReviewStartsAutomatically: 'Análise da Meta começa automaticamente',
    deliveryStarts: 'Veiculação começa nesta etapa',
    audiencePlan: 'Plano de público',
    firstMonth: 'Público no primeiro mês',
    competitorPhysicalTest: 'Teste próximo a lojas concorrentes',
    competitorInstagramVisitors: 'Visitantes do Instagram de concorrentes',
    currency: 'Moeda',
    immediateMaximum: 'Gasto imediato máximo',
    authorizedMonthlyCeiling: 'Limite mensal autorizado',
    reason: 'Por que este é o limite',
    required: 'O que precisa acontecer',
    cards: 'Criativos do carrossel',
    officialWhatsapp: 'WhatsApp oficial da loja',
    locations: 'Cidades da campanha',
    objective: 'Objetivo',
    publication: 'Publicação nesta etapa',
    placements: 'Onde o anúncio aparecerá',
    audience: 'Público',
    optimization: 'Otimização',
    trackingCode: 'Código de rastreamento',
    configuredMaximum: 'Valor configurado para o período',
    followerBaseline: 'Marco inicial de seguidores',
    categoryName: 'Categoria',
    priceCents: 'Preço exibido',
    stock: 'Estoque disponível',
    headline: 'Frase principal',
    callToAction: 'Botão de ação',
    whatsappMessage: 'Mensagem preparada para o bot',
};

const VALUE_LABELS: Record<string, string> = {
    PAUSED: 'Pausada',
    ACTIVE: 'Ativa',
    lifetime: 'Orçamento total para todo o período',
    daily: 'Orçamento diário',
    storewide: 'Loja inteira',
    smartphones: 'Somente smartphones',
    BRL: 'Real brasileiro (R$)',
    'Broad local audience within Petrolina-PE and Juazeiro-BA': 'Público amplo e local, limitado a Petrolina-PE e Juazeiro-BA.',
    'Only after 15-30 days of baseline data and without increasing the monthly cap': 'Somente depois de 15 a 30 dias de resultados iniciais e sem aumentar o limite mensal.',
    'Not targetable; use only authorized first-party audiences and broad signals': 'A Meta não permite segmentar diretamente os visitantes de perfis concorrentes. Serão usados apenas públicos próprios autorizados e sinais amplos.',
    'Exactly two campaigns confirmed PAUSED; zero ad sets, ads and spend': 'As duas campanhas devem ser confirmadas como pausadas, sem conjuntos de anúncios, sem anúncios publicados e sem qualquer gasto.',
    'This approval creates only paused campaign shells without budget, ad sets or ads': 'Esta aprovação cria somente a estrutura das campanhas pausadas, sem aplicar orçamento, criar conjuntos ou publicar anúncios.',
    'Os containers permanecem pausados. Qualquer exclusão ou arquivamento exige nova aprovação.': 'As estruturas das campanhas permanecem pausadas. Qualquer exclusão ou arquivamento exige uma nova aprovação.',
};

function humanizeKey(value: string): string {
    return FIELD_LABELS[value] || value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function translateText(value: string): string {
    return VALUE_LABELS[value] || value;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatValue(value: unknown, field?: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') {
        if (field === 'authorizedAmount' || field === 'periodLimit' || field === 'immediateMaximum' || field === 'authorizedMonthlyCeiling') {
            return formatCurrency(value);
        }
        if (field === 'priceCents') return formatCurrency(value / 100);
        if (field === 'durationDays') return `${value} dias`;
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
    }
    return translateText(String(value));
}

function ReadableValue({ value, field, depth = 0 }: { value: unknown; field?: string; depth?: number }) {
    if (Array.isArray(value)) {
        if (!value.length) return <span className="text-sm text-slate-400">Nenhum item.</span>;
        if (field === 'cards') {
            return (
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                    {value.map((raw, index) => {
                        const card = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
                        const imageUrl = typeof card.imageUrl === 'string' ? card.imageUrl : '';
                        return (
                            <article key={String(card.productId || index)} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="aspect-square bg-gradient-to-br from-white to-slate-100 p-3">
                                    {imageUrl ? <img src={imageUrl} alt={String(card.name || 'Produto')} className="h-full w-full object-contain" loading="lazy" /> : null}
                                </div>
                                <div className="space-y-1.5 border-t border-slate-100 p-3">
                                    <p className="line-clamp-2 text-sm font-black text-slate-900">{String(card.name || 'Produto')}</p>
                                    <p className="text-base font-black text-emerald-700">{formatValue(card.priceCents, 'priceCents')}</p>
                                    <p className="text-xs font-semibold text-slate-500">Código: {String(card.sku || '—')} · estoque {String(card.stock || '—')}</p>
                                    <p className="rounded-lg bg-green-50 p-2 text-[11px] font-semibold leading-4 text-green-800">{String(card.whatsappMessage || '')}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            );
        }
        return (
            <div className={`grid gap-3 ${field === 'campaigns' ? 'md:grid-cols-2' : ''}`}>
                {value.map((item, index) => (
                    <div key={index} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                        <p className="mb-3 inline-flex items-center gap-2 text-sm font-black text-slate-800">
                            <Megaphone className="h-4 w-4 text-blue-600" /> Campanha {index + 1}
                        </p>
                        <ReadableValue value={item} depth={depth + 1} />
                    </div>
                ))}
            </div>
        );
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'itemKey' && key !== 'imageUrl' && key !== 'productId');
        if (!entries.length) return <span className="text-sm text-slate-400">Nenhuma informação.</span>;
        return (
            <dl className={depth > 0 ? 'space-y-2' : 'space-y-3'}>
                {entries.map(([key, raw]) => {
                    const nested = Array.isArray(raw) || (raw !== null && typeof raw === 'object');
                    return (
                        <div key={key} className={nested ? 'rounded-lg border border-slate-100 bg-slate-50/70 p-3' : 'flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0'}>
                            <dt className={`${nested ? 'mb-3' : ''} text-xs font-bold uppercase tracking-wide text-slate-500`}>{humanizeKey(key)}</dt>
                            <dd className={nested ? '' : 'max-w-[68%] break-words text-right text-sm font-semibold leading-relaxed text-slate-700'}>
                                <ReadableValue value={raw} field={key} depth={depth + 1} />
                            </dd>
                        </div>
                    );
                })}
            </dl>
        );
    }

    return <span>{formatValue(value, field)}</span>;
}

function Snapshot({ value, emptyLabel }: { value: MarketingJson | null; emptyLabel: string }) {
    if (!value || (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0)) {
        return <p className="text-sm text-slate-400">{emptyLabel}</p>;
    }
    return <ReadableValue value={value} />;
}

function getRecord(value: MarketingJson | null): Record<string, unknown> {
    return value && !Array.isArray(value) ? value : {};
}

function PlainLanguageSummary({ request }: { request: MarketingApprovalRequest }) {
    const proposed = getRecord(request.proposed_state);
    const financial = getRecord(request.financial_impact);
    const campaigns = Array.isArray(proposed.campaigns) ? proposed.campaigns : [];
    const immediate = typeof financial.immediateMaximum === 'number' ? financial.immediateMaximum : null;
    const status = getRecord(proposed.externalCreation as MarketingJson | null).status;

    return (
        <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 lg:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Resumo em linguagem simples</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                Esta aprovação {campaigns.length ? `prepara ${campaigns.length} campanhas` : 'prepara a alteração descrita abaixo'}{status === 'PAUSED' ? ' e mantém tudo pausado' : ''}. Nada além do que aparece nesta tela será autorizado.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100"><Megaphone className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-lg font-black text-slate-900">{campaigns.length || '—'}</p><p className="text-xs font-semibold text-slate-500">Campanhas nesta ação</p></div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100"><WalletCards className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-lg font-black text-slate-900">{immediate === null ? 'Ver detalhes' : formatCurrency(immediate)}</p><p className="text-xs font-semibold text-slate-500">Gasto imediato máximo</p></div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100"><MapPin className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-sm font-black text-slate-900">Petrolina e Juazeiro</p><p className="text-xs font-semibold text-slate-500">Região planejada</p></div>
            </div>
        </section>
    );
}

function channelLabel(value: string): string {
    return value.toLowerCase() === 'instagram' ? 'Instagram' : translateText(value);
}

function targetTypeLabel(value: string): string {
    const labels: Record<string, string> = {
        meta_campaign_bundle: 'Grupo de campanhas da Meta',
        meta_ad_bundle: 'Campanhas, conjuntos e anúncios da Meta',
        campaign: 'Campanha',
        ad_set: 'Conjunto de anúncios',
        ad: 'Anúncio',
        creative: 'Criativo',
    };
    return labels[value] || humanizeKey(value);
}

function executionLabel(request: MarketingApprovalRequest) {
    if (request.execution_mode === 'lenovo_chrome') {
        return { label: 'Lenovo + Chrome', icon: Laptop, className: 'text-indigo-700 bg-indigo-50' };
    }
    if (request.execution_mode === 'manual') {
        return { label: 'Execução manual', icon: Bot, className: 'text-slate-700 bg-slate-100' };
    }
    return { label: 'Automático pelo servidor', icon: CloudCog, className: 'text-cyan-700 bg-cyan-50' };
}

function persistentOutcome(request: MarketingApprovalRequest): string {
    const creativePlan = request.action_type.includes('creative_plan');
    const campaignBundle = request.action_type.includes('campaign_bundle');
    const pausedAdBundle = request.action_type.includes('paused_whatsapp_ad_bundle');
    if (request.status === 'pending') return 'Aguardando sua decisão.';
    if (request.status === 'approved' && creativePlan) return 'Criativos aprovados. O anúncio ainda não foi criado nem colocado em veiculação.';
    if (request.status === 'approved') return 'Aprovação registrada. A execução ainda não foi confirmada.';
    if (request.status === 'executing') return 'Aprovada e em execução. Isso ainda não confirma que a campanha entrou em veiculação.';
    if (request.status === 'succeeded' && creativePlan) return 'Criativos aprovados. Esta etapa não publica nem ativa anúncios.';
    if (request.status === 'succeeded' && pausedAdBundle) return 'Anúncios completos criados e enviados para análise da Meta, mas permanecem pausados e sem gasto.';
    if (request.status === 'succeeded' && campaignBundle) return 'Estrutura criada na Meta e mantida pausada, sem entrega ou cobrança.';
    if (request.status === 'succeeded') return 'Execução concluída e registrada.';
    if (request.status === 'failed') return 'A execução falhou e precisa de atenção.';
    return `Decisão registrada: ${STATUS_META[request.status].label.toLowerCase()}.`;
}

export default function MarketingApprovalCenterPanel() {
    const [filter, setFilter] = useState<ApprovalFilter>('all');
    const [requests, setRequests] = useState<MarketingApprovalRequest[]>([]);
    const [counts, setCounts] = useState<Partial<Record<MarketingApprovalStatus, number>>>({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [decisionTarget, setDecisionTarget] = useState<MarketingApprovalRequest | null>(null);
    const [decision, setDecision] = useState<MarketingApprovalDecision>('approve');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async (quiet = false, requestedFilter: ApprovalFilter = filter) => {
        if (!quiet) setLoading(true);
        try {
            const response = await marketingApprovalService.list(requestedFilter);
            setRequests(response.items || []);
            setCounts(response.counts || {});
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível carregar as aprovações.');
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
        const interval = window.setInterval(() => load(true), 30_000);
        return () => window.clearInterval(interval);
    }, [load]);

    const summary = useMemo(() => ({
        pending: Number(counts.pending || 0),
        running: Number(counts.approved || 0) + Number(counts.executing || 0),
        failed: Number(counts.failed || 0),
        succeeded: Number(counts.succeeded || 0),
    }), [counts]);

    const openDecision = (request: MarketingApprovalRequest, nextDecision: MarketingApprovalDecision) => {
        setDecisionTarget(request);
        setDecision(nextDecision);
        setNote('');
    };

    const submitDecision = async () => {
        if (!decisionTarget) return;
        if (decision === 'reject' && !note.trim()) {
            toast.error('Informe o motivo da rejeição.');
            return;
        }
        setSubmitting(true);
        try {
            await marketingApprovalService.decide(decisionTarget.id, decision, note.trim());
            toast.success(decision === 'approve' ? 'Aprovação registrada. O comprovante continuará visível na tela.' : 'Ação rejeitada.');
            setDecisionTarget(null);
            setFilter('all');
            await load(true, 'all');
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível registrar a decisão.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15"><ShieldCheck className="h-7 w-7 text-emerald-300" /></div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">Controle humano</p>
                            <h2 className="mt-1 text-2xl font-black">Central de Aprovações</h2>
                            <p className="mt-2 max-w-2xl text-sm text-slate-300">Nenhuma publicação, pausa ou mudança de orçamento é executada antes de você conferir alvo, impacto e reversão.</p>
                        </div>
                    </div>
                    <button onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-50">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar fila
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: 'Aguardando você', value: summary.pending, icon: Clock3, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Liberadas/rodando', value: summary.running, icon: CloudCog, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Concluídas', value: summary.succeeded, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Precisam atenção', value: summary.failed, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className={`inline-flex rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
                        <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                {FILTERS.map((item) => (
                    <button key={item.value} onClick={() => setFilter(item.value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${filter === item.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        {item.label}{item.value !== 'all' && counts[item.value] !== undefined ? ` (${counts[item.value]})` : ''}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando aprovações...</div>
            ) : requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-3 font-black text-slate-800">Nenhuma ação nesta fila</h3>
                    <p className="mt-1 text-sm text-slate-500">Quando o agente preparar uma alteração protegida, ela aparecerá aqui antes da execução.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => {
                        const status = STATUS_META[request.status];
                        const executor = executionLabel(request);
                        const ExecutorIcon = executor.icon;
                        const expanded = expandedId === request.id;
                        return (
                            <article key={request.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${status.className}`}>{status.label}</span>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${executor.className}`}><ExecutorIcon className="h-3.5 w-3.5" />{executor.label}</span>
                                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{channelLabel(request.channel)}</span>
                                            </div>
                                            <h3 className="mt-3 text-lg font-black text-slate-900">{request.title}</h3>
                                            <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-bold ${request.status === 'succeeded' ? 'bg-emerald-50 text-emerald-800' : request.status === 'failed' ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>{persistentOutcome(request)}</p>
                                            <p className="mt-1 text-sm text-slate-500">{targetTypeLabel(request.target_type)}: <strong className="text-slate-700">{request.target_name || request.target_id || 'alvo a confirmar'}</strong></p>
                                            <p className="mt-2 text-xs text-slate-400">Solicitada em {formatDate(request.created_at)}{request.approval_expires_at ? ` · expira em ${formatDate(request.approval_expires_at)}` : ''}</p>
                                        </div>
                                        {request.status === 'pending' && (
                                            <div className="flex shrink-0 gap-2">
                                                <button onClick={() => openDecision(request, 'reject')} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"><XCircle className="h-4 w-4" /> Rejeitar</button>
                                                <button onClick={() => openDecision(request, 'approve')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"><ShieldCheck className="h-4 w-4" /> Revisar e aprovar</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button onClick={() => setExpandedId(expanded ? null : request.id)} className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-100">
                                    <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Ver impacto completo</span>
                                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>

                                {expanded && (
                                    <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2">
                                        <PlainLanguageSummary request={request} />
                                        <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2"><p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estado atual</p><Snapshot value={request.current_state} emptyLabel="Novo ativo, sem estado anterior." /></section>
                                        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 lg:col-span-2"><p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-blue-600">O que será preparado</p><Snapshot value={request.proposed_state} emptyLabel="Proposta não informada." /></section>
                                        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700">Limites financeiros</p><Snapshot value={request.financial_impact} emptyLabel="Sem impacto financeiro informado." /></section>
                                        <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Como saberemos que deu certo</p><Snapshot value={request.success_criteria} emptyLabel="Critério ainda não informado." /></section>
                                        <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2"><p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500"><RotateCcw className="h-4 w-4" /> Como desfazer</p><p className="text-sm font-medium leading-relaxed text-slate-700">{translateText(request.rollback_plan)}</p></section>
                                        {request.last_error && <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 lg:col-span-2"><p className="text-xs font-black uppercase tracking-wide text-rose-600">Erro do executor</p><p className="mt-2 text-sm text-rose-800">{request.last_error}</p></section>}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}

            {decisionTarget && (
                <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="marketing-approval-dialog-title" className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-white shadow-2xl">
                        <div className={`shrink-0 border-b p-5 sm:px-8 ${decision === 'approve' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                            <p className={`text-xs font-black uppercase tracking-[0.18em] ${decision === 'approve' ? 'text-emerald-600' : 'text-rose-600'}`}>{decision === 'approve' ? 'Confirmação final' : 'Bloquear execução'}</p>
                            <h3 id="marketing-approval-dialog-title" className="mt-1 text-xl font-black text-slate-900">{decisionTarget.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{decisionTarget.target_name || decisionTarget.target_id || 'Alvo a confirmar'}</p>
                        </div>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:p-8">
                            <PlainLanguageSummary request={decisionTarget} />
                            <div className="grid gap-4 xl:grid-cols-2">
                                <section className="rounded-xl border border-slate-200 p-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">Antes</p><Snapshot value={decisionTarget.current_state} emptyLabel="Novo ativo." /></section>
                                <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-blue-500">Depois</p><Snapshot value={decisionTarget.proposed_state} emptyLabel="Sem dados." /></section>
                            </div>
                            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-amber-600">Impacto financeiro máximo</p><Snapshot value={decisionTarget.financial_impact} emptyLabel="Nenhum impacto financeiro informado." /></section>
                            <section className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Como desfazer</p><p className="mt-2 text-sm font-medium text-slate-700">{translateText(decisionTarget.rollback_plan)}</p></section>
                            <label className="block"><span className="text-sm font-bold text-slate-700">{decision === 'approve' ? 'Observação da aprovação (opcional)' : 'Motivo da rejeição'}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder={decision === 'approve' ? 'Ex.: aprovado somente dentro do teto exibido.' : 'Explique o que precisa ser corrigido.'} /></label>
                        </div>
                        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:px-8">
                            <button onClick={() => setDecisionTarget(null)} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                            <button onClick={submitDecision} disabled={submitting} className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 ${decision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'approve' ? <ShieldCheck className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{decision === 'approve' ? 'Confirmar aprovação' : 'Confirmar rejeição'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
