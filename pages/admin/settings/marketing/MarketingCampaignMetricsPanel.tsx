import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, HelpCircle, Loader2, MessageCircle, RefreshCw, ShoppingCart, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
    metaMarketingConnectionService,
    type MetaCampaignInsightItem,
    type MetaCampaignInsightsReport,
    type MetaCampaignMetrics,
    type MetaInsightsDatePreset,
} from '../../../../services/metaMarketingConnectionService';

type MetricFormat = 'currency' | 'integer' | 'decimal' | 'percent' | 'ratio';
type MetricDefinition = {
    key: keyof MetaCampaignMetrics;
    label: string;
    format: MetricFormat;
    description: string;
    interpretation: string;
    zeroMeansUnavailable?: boolean;
};

const PERIODS: Array<{ value: MetaInsightsDatePreset; label: string }> = [
    { value: 'last_7d', label: 'Últimos 7 dias' },
    { value: 'last_14d', label: 'Últimos 14 dias' },
    { value: 'last_30d', label: 'Últimos 30 dias' },
    { value: 'this_month', label: 'Este mês' },
];

const SECTIONS: Array<{ title: string; subtitle: string; metrics: MetricDefinition[] }> = [
    {
        title: 'Resultados de negócio',
        subtitle: 'Os indicadores mais próximos de venda e atendimento no WhatsApp.',
        metrics: [
            { key: 'conversations', label: 'Conversas iniciadas', format: 'integer', description: 'Conversas atribuídas pela Meta aos anúncios no período.', interpretation: 'Quanto mais conversas qualificadas, maior a oportunidade de venda. Confirme a qualidade no bot.', zeroMeansUnavailable: true },
            { key: 'costPerConversation', label: 'Custo por conversa', format: 'currency', description: 'Gasto dividido pelas conversas iniciadas atribuídas.', interpretation: 'Deve ser analisado junto da qualidade e da taxa de fechamento, nunca sozinho.', zeroMeansUnavailable: true },
            { key: 'purchases', label: 'Compras atribuídas', format: 'integer', description: 'Compras que a mensuração da Meta conseguiu atribuir à campanha.', interpretation: 'Zero pode significar ausência de vendas ou mensuração ainda não configurada.', zeroMeansUnavailable: true },
            { key: 'purchaseValue', label: 'Receita atribuída', format: 'currency', description: 'Valor das compras enviado à Meta e atribuído aos anúncios.', interpretation: 'Só é confiável se Pixel, CAPI ou integração do atendimento enviarem valores corretos.', zeroMeansUnavailable: true },
            { key: 'costPerPurchase', label: 'Custo por compra', format: 'currency', description: 'Gasto dividido pelo número de compras atribuídas.', interpretation: 'Compare com margem, lucro e ticket médio para saber se a venda é sustentável.', zeroMeansUnavailable: true },
            { key: 'roas', label: 'ROAS', format: 'ratio', description: 'Receita atribuída dividida pelo gasto em anúncios.', interpretation: 'ROAS 3,0x significa R$ 3 atribuídos para cada R$ 1 investido; não equivale a lucro.', zeroMeansUnavailable: true },
        ],
    },
    {
        title: 'Investimento e entrega',
        subtitle: 'Mostra quanto foi gasto e como a Meta distribuiu os anúncios.',
        metrics: [
            { key: 'spend', label: 'Gasto realizado', format: 'currency', description: 'Valor efetivamente consumido pela campanha no período.', interpretation: 'Compare com o orçamento autorizado e com os resultados gerados.' },
            { key: 'impressions', label: 'Impressões', format: 'integer', description: 'Número total de exibições dos anúncios, incluindo repetições.', interpretation: 'Serve para entender volume de entrega; não representa pessoas únicas.' },
            { key: 'reach', label: 'Alcance', format: 'integer', description: 'Estimativa de pessoas únicas que viram os anúncios.', interpretation: 'Ajuda a medir cobertura nas cidades selecionadas.' },
            { key: 'frequency', label: 'Frequência', format: 'decimal', description: 'Média de vezes que cada pessoa alcançada viu o anúncio.', interpretation: 'Crescimento com queda de resposta pode indicar saturação do criativo.' },
            { key: 'cpm', label: 'CPM', format: 'currency', description: 'Custo para mil impressões.', interpretation: 'Diagnostica o preço da entrega; CPM baixo não garante venda.' },
        ],
    },
    {
        title: 'Cliques e intenção',
        subtitle: 'Ajuda a separar curiosidade de ações que aproximam o cliente do WhatsApp.',
        metrics: [
            { key: 'clicks', label: 'Todos os cliques', format: 'integer', description: 'Inclui qualquer clique no anúncio, não apenas o botão de contato.', interpretation: 'É uma medida ampla de interação e pode incluir ações sem intenção de compra.' },
            { key: 'uniqueClicks', label: 'Cliques únicos', format: 'integer', description: 'Estimativa de pessoas diferentes que clicaram.', interpretation: 'Reduz o efeito de uma mesma pessoa clicar várias vezes.' },
            { key: 'linkClicks', label: 'Cliques no link/CTA', format: 'integer', description: 'Cliques no destino ou chamada principal do anúncio.', interpretation: 'Para estas campanhas, deve aproximar o cliente do WhatsApp.' },
            { key: 'outboundClicks', label: 'Cliques de saída', format: 'integer', description: 'Cliques que levaram a pessoa para fora das superfícies da Meta.', interpretation: 'Ajuda a verificar se o usuário realmente avançou ao destino.' },
            { key: 'ctr', label: 'CTR', format: 'percent', description: 'Percentual de impressões que geraram clique.', interpretation: 'Indica capacidade do anúncio de despertar ação, mas não mede qualidade da conversa.' },
            { key: 'cpc', label: 'CPC', format: 'currency', description: 'Gasto dividido por todos os cliques.', interpretation: 'Use para diagnóstico de tráfego; a métrica principal continua sendo venda/conversa qualificada.' },
            { key: 'costPerLinkClick', label: 'Custo por clique no CTA', format: 'currency', description: 'Gasto dividido pelos cliques no link ou chamada principal.', interpretation: 'É mais específico que CPC para avaliar o caminho até o WhatsApp.' },
        ],
    },
    {
        title: 'Interação e vídeo',
        subtitle: 'Métricas auxiliares para diagnosticar criativo, sem confundir engajamento com venda.',
        metrics: [
            { key: 'engagements', label: 'Interações com o anúncio', format: 'integer', description: 'Soma de interações registradas pela Meta no anúncio.', interpretation: 'Útil para entender atenção, mas não comprova intenção de compra.' },
            { key: 'videoPlays', label: 'Reproduções de vídeo', format: 'integer', description: 'Quantidade de reproduções registradas para criativos em vídeo.', interpretation: 'Use somente em anúncios com vídeo e compare com retenção e ações posteriores.', zeroMeansUnavailable: true },
            { key: 'thruPlays', label: 'ThruPlays', format: 'integer', description: 'Visualizações qualificadas segundo o critério de ThruPlay da Meta.', interpretation: 'Ajuda a avaliar retenção do vídeo; não é resultado de venda.', zeroMeansUnavailable: true },
        ],
    },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMetric(value: number, format: MetricFormat, unavailable: boolean) {
    if (unavailable) return 'Não mensurado';
    if (format === 'currency') return money.format(value || 0);
    if (format === 'integer') return integer.format(value || 0);
    if (format === 'percent') return `${decimal.format(value || 0)}%`;
    if (format === 'ratio') return `${decimal.format(value || 0)}x`;
    return decimal.format(value || 0);
}

function variation(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return (current - previous) / Math.abs(previous) * 100;
}

function MetricCard({ definition, current, previous, infoKey, expanded, onToggle }: {
    definition: MetricDefinition;
    current: number;
    previous: number;
    infoKey: string;
    expanded: boolean;
    onToggle: (key: string) => void;
}) {
    const unavailable = Boolean(definition.zeroMeansUnavailable && current === 0);
    const change = variation(current, previous);
    const ChangeIcon = change !== null && change < 0 ? TrendingDown : TrendingUp;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{definition.label}</p><button type="button" onClick={() => onToggle(infoKey)} className="rounded-full text-slate-400 hover:text-indigo-600" aria-label={`Entenda ${definition.label}`} title={`Entenda ${definition.label}`}><HelpCircle className="h-4 w-4" /></button></div>
            <p className={`mt-2 font-black ${unavailable ? 'text-sm text-slate-400' : 'text-xl text-slate-900'}`}>{formatMetric(current, definition.format, unavailable)}</p>
            {change !== null && !unavailable && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-500"><ChangeIcon className="h-3 w-3" />{change >= 0 ? '+' : ''}{decimal.format(change)}% vs. período anterior</p>}
            {expanded && <div className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600"><p>{definition.description}</p><p className="mt-1"><strong>Como interpretar:</strong> {definition.interpretation}</p></div>}
        </div>
    );
}

function CampaignMetrics({ item, previous, expandedInfo, onToggle }: {
    item: MetaCampaignInsightItem;
    previous?: MetaCampaignInsightItem;
    expandedInfo: string | null;
    onToggle: (key: string) => void;
}) {
    return (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
            <header className="flex flex-col gap-2 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-indigo-500">Campanha Meta</p><h3 className="mt-1 text-lg font-black text-slate-900">{item.campaignName}</h3></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status === 'ACTIVE' ? 'Ativa' : item.status}</span></header>
            <div className="space-y-6 p-5">
                {item.followers && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-2"><UserPlus className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h4 className="font-black text-emerald-950">Crescimento de seguidores durante a campanha</h4><p className="mt-1 text-xs leading-5 text-emerald-900">{item.followers.explanation}</p></div></div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-black uppercase text-slate-500">Seguidores no início</p><p className="mt-1 text-xl font-black text-slate-900">{item.followers.baselineFollowers == null ? 'Ao ativar' : integer.format(item.followers.baselineFollowers)}</p></div>
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-black uppercase text-slate-500">Seguidores atuais</p><p className="mt-1 text-xl font-black text-slate-900">{item.followers.currentFollowers == null ? 'Indisponível' : integer.format(item.followers.currentFollowers)}</p></div>
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-black uppercase text-slate-500">Aumento observado</p><p className="mt-1 text-xl font-black text-slate-900">{item.followers.gainedFollowers == null ? 'A calcular' : `${item.followers.gainedFollowers >= 0 ? '+' : ''}${integer.format(item.followers.gainedFollowers)}`}</p></div>
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-black uppercase text-slate-500">Crescimento</p><p className="mt-1 text-xl font-black text-slate-900">{item.followers.growthPercent == null ? 'A calcular' : `${item.followers.growthPercent >= 0 ? '+' : ''}${decimal.format(item.followers.growthPercent)}%`}</p></div>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-emerald-900"><strong>Como interpretar:</strong> é um indicador auxiliar da conta. Vendas, conversas qualificadas e custo por resultado continuam sendo as métricas principais.</p>
                </section>}
                {SECTIONS.map((section) => <section key={section.title}><h4 className="font-black text-slate-900">{section.title}</h4><p className="mt-1 text-xs text-slate-500">{section.subtitle}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{section.metrics.map((definition) => { const key = `${item.campaignId}:${String(definition.key)}`; return <MetricCard key={key} definition={definition} current={item.metrics[definition.key]} previous={previous?.metrics[definition.key] || 0} infoKey={key} expanded={expandedInfo === key} onToggle={onToggle} />; })}</div></section>)}
                {item.actions.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-black text-slate-800">Todas as ações adicionais informadas pela Meta ({item.actions.length})</summary><p className="mt-2 text-xs leading-5 text-slate-500">Esta lista preserva os eventos técnicos recebidos da API. Os indicadores comerciais reconhecidos já aparecem traduzidos acima; nomes não traduzidos devem ser auditados antes de orientar uma decisão.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{item.actions.map((action) => <div key={action.action_type} className="rounded-lg bg-slate-50 p-3"><p className="break-all text-[11px] font-bold text-slate-500">{action.action_type}</p><p className="mt-1 text-lg font-black text-slate-900">{integer.format(Number(action.value || 0))}</p></div>)}</div></details>}
            </div>
        </article>
    );
}

export default function MarketingCampaignMetricsPanel() {
    const [datePreset, setDatePreset] = useState<MetaInsightsDatePreset>('last_7d');
    const [report, setReport] = useState<MetaCampaignInsightsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [unavailableReason, setUnavailableReason] = useState('');
    const [expandedInfo, setExpandedInfo] = useState<string | null>(null);

    const load = async (preset = datePreset) => {
        setLoading(true);
        setUnavailableReason('');
        try {
            const connection = await metaMarketingConnectionService.getStatus();
            if (connection.status !== 'connected' || !connection.selectedAdAccount) {
                setReport(null);
                setUnavailableReason('Conecte a Meta e confirme a conta de anúncios acima para acompanhar os indicadores.');
                return;
            }
            setReport(await metaMarketingConnectionService.getInsights(preset));
        } catch (error: any) {
            setReport(null);
            setUnavailableReason('Os indicadores ainda não puderam ser consultados. Verifique a conexão Meta acima.');
            toast.error(error?.message || 'Não foi possível carregar os indicadores.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(datePreset); }, [datePreset]);

    const previousByCampaign = useMemo(() => new Map(
        (report?.previous.campaigns || []).map((campaign) => [campaign.campaignId, campaign]),
    ), [report]);

    const toggleInfo = (key: string) => setExpandedInfo((current) => current === key ? null : key);
    const totals = report?.current.totals;

    return (
        <section className="space-y-5 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-600 p-2.5 text-white"><BarChart3 className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-wide text-indigo-600">Acompanhamento de campanhas</p><h2 className="mt-1 text-xl font-black text-slate-900">Indicadores explicados</h2><p className="mt-1 text-sm text-slate-600">Clique no ícone <HelpCircle className="inline h-3.5 w-3.5" /> de qualquer item para entender o que representa e como interpretar.</p></div></div>
                <div className="flex gap-2"><select value={datePreset} onChange={(event) => setDatePreset(event.target.value as MetaInsightsDatePreset)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">{PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}</select><button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Atualizar</button></div>
            </div>

            {loading && !report && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Buscando dados oficiais da Meta...</div>}
            {!loading && unavailableReason && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{unavailableReason}</div>}

            {report && totals && <>
                <div className="rounded-xl border border-indigo-100 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Período analisado</p><p className="mt-1 text-sm font-bold text-slate-900">{report.ranges.current.since} até {report.ranges.current.until}</p><p className="mt-1 text-xs text-slate-500">Comparação automática com {report.ranges.previous.since} até {report.ranges.previous.until}. {report.attribution}</p></div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Gasto total</p><p className="mt-2 text-2xl font-black">{money.format(totals.spend)}</p></div><div className="rounded-xl bg-green-700 p-4 text-white"><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-green-100"><MessageCircle className="h-3.5 w-3.5" />Conversas atribuídas</p><p className="mt-2 text-2xl font-black">{totals.conversations ? integer.format(totals.conversations) : 'Não mensurado'}</p></div><div className="rounded-xl bg-indigo-700 p-4 text-white"><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-indigo-100"><ShoppingCart className="h-3.5 w-3.5" />Compras atribuídas</p><p className="mt-2 text-2xl font-black">{totals.purchases ? integer.format(totals.purchases) : 'Não mensurado'}</p></div><div className="rounded-xl bg-violet-700 p-4 text-white"><p className="text-xs font-black uppercase tracking-wide text-violet-100">ROAS atribuído</p><p className="mt-2 text-2xl font-black">{totals.roas ? `${decimal.format(totals.roas)}x` : 'Não mensurado'}</p></div><div className="rounded-xl bg-emerald-700 p-4 text-white"><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-100"><UserPlus className="h-3.5 w-3.5" />Seguidores atuais</p><p className="mt-2 text-2xl font-black">{report.instagramFollowers?.currentFollowers == null ? 'Indisponível' : integer.format(report.instagramFollowers.currentFollowers)}</p><p className="mt-1 text-[10px] text-emerald-100">Total da conta Instagram</p></div></div>

                {report.current.campaigns.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Não houve entrega registrada para campanhas neste período.</div> : <div className="space-y-5">{report.current.campaigns.map((campaign) => <CampaignMetrics key={campaign.campaignId} item={campaign} previous={previousByCampaign.get(campaign.campaignId)} expandedInfo={expandedInfo} onToggle={toggleInfo} />)}</div>}

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Leitura responsável:</strong> resultados zerados de conversa, compra, receita ou ROAS podem significar ausência real ou mensuração incompleta. O agente deve conferir o encaminhamento do anúncio, o identificador recebido pelo bot e as vendas fechadas antes de recomendar mudanças.</div>
            </>}
        </section>
    );
}
