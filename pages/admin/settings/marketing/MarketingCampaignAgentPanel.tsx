import React, { useEffect, useMemo, useState } from 'react';
import {
    BrainCircuit,
    CircleDollarSign,
    Lightbulb,
    Loader2,
    MapPin,
    MessageCircle,
    Save,
    ShieldCheck,
    Target,
    Smartphone,
    Store,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    DEFAULT_MARKETING_CAMPAIGN_PORTFOLIO,
    marketingCampaignPortfolioService,
    type MarketingCampaignBlueprint,
    type MarketingCampaignPortfolio,
} from '../../../../services/marketingCampaignPortfolioService';
import { getCompanyData } from '../../../../services/companyService';
import MetaMarketingConnectionPanel from './MetaMarketingConnectionPanel';
import MarketingCampaignMetricsPanel from './MarketingCampaignMetricsPanel';
import { metaMarketingConnectionService } from '../../../../services/metaMarketingConnectionService';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function calculatePeriodLimit(campaign: MarketingCampaignBlueprint): number | null {
    if (!campaign.authorizedAmount) return null;
    return campaign.budgetType === 'daily'
        ? campaign.authorizedAmount * campaign.durationDays
        : campaign.authorizedAmount;
}

export default function MarketingCampaignAgentPanel() {
    const [portfolio, setPortfolio] = useState<MarketingCampaignPortfolio>(DEFAULT_MARKETING_CAMPAIGN_PORTFOLIO);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preparingApproval, setPreparingApproval] = useState(false);
    const [officialWhatsapp, setOfficialWhatsapp] = useState('');

    useEffect(() => {
        let cancelled = false;
        marketingCampaignPortfolioService.get()
            .then((value) => { if (!cancelled) setPortfolio(value); })
            .catch((error: any) => toast.error(error?.message || 'Não foi possível carregar as campanhas.'))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getCompanyData()
            .then((company) => { if (!cancelled) setOfficialWhatsapp(company.phone || ''); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const updateCampaign = (id: MarketingCampaignBlueprint['id'], patch: Partial<MarketingCampaignBlueprint>) => {
        setPortfolio((current) => ({
            ...current,
            campaigns: current.campaigns.map((campaign) => campaign.id === id ? { ...campaign, ...patch } : campaign),
        }));
    };

    const totalAuthorized = useMemo(() => portfolio.campaigns.reduce((sum, campaign) => {
        const limit = calculatePeriodLimit(campaign);
        return sum + (limit || 0);
    }, 0), [portfolio]);

    const configuredCount = portfolio.campaigns.filter((campaign) => Boolean(campaign.authorizedAmount)).length;

    const save = async () => {
        setSaving(true);
        try {
            await marketingCampaignPortfolioService.save(portfolio);
            setPortfolio((current) => ({ ...current, updatedAt: new Date().toISOString() }));
            toast.success('Orçamentos e diretrizes salvos para o agente.');
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível salvar o portfólio.');
        } finally {
            setSaving(false);
        }
    };

    const prepareDraftApproval = async () => {
        setPreparingApproval(true);
        try {
            await marketingCampaignPortfolioService.save(portfolio);
            const response = await metaMarketingConnectionService.prepareCampaignDraftApproval();
            toast.success(response.reused
                ? 'A solicitação segura já existe na Central de Aprovações.'
                : 'Solicitação criada. Revise em Marketing > Aprovações.');
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível preparar os rascunhos pausados.');
        } finally {
            setPreparingApproval(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando especialista de campanhas...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <MetaMarketingConnectionPanel />

            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-indigo-400/15 p-3 ring-1 ring-indigo-300/20"><BrainCircuit className="h-7 w-7 text-indigo-200" /></div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">Especialista de campanhas</p>
                            <h2 className="mt-1 text-2xl font-black">Duas campanhas, orçamento sob seu controle</h2>
                            <p className="mt-2 max-w-3xl text-sm text-slate-300">Você informa o teto. O agente sugere a distribuição, explica cada decisão e nunca altera gasto ou ativa campanha sem passar pela Central de Aprovações.</p>
                        </div>
                    </div>
                    <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-400 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar para o agente</button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Campanhas configuradas</p><p className="mt-2 text-2xl font-black text-slate-900">{configuredCount}/2</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Limite do período</p><p className="mt-2 text-2xl font-black text-slate-900">{money.format(totalAuthorized)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Geografia fixa</p><p className="mt-2 text-sm font-black text-slate-900">Petrolina–PE + Juazeiro–BA</p></div>
            </div>

            <MarketingCampaignMetricsPanel />

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <Target className="mt-0.5 h-5 w-5 text-sky-700" />
                        <div>
                            <h3 className="font-black text-sky-950">Público inicial: amplo e local</h3>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-sky-900">No primeiro mês, o agente mantém Petrolina–PE e Juazeiro–BA como limites rígidos e evita fragmentar o orçamento por lojas concorrentes. Um teste de proximidade física só será sugerido após 15–30 dias de dados, sem aumentar o teto mensal. Visitantes de perfis concorrentes não serão simulados nem coletados.</p>
                        </div>
                    </div>
                    <button onClick={prepareDraftApproval} disabled={preparingApproval || configuredCount !== 2} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50">{preparingApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Preparar rascunhos pausados</button>
                </div>
                <p className="mt-3 text-xs font-semibold text-sky-800">Esta ação cria somente uma solicitação. Depois da sua aprovação, a VPS poderá criar dois containers PAUSADOS, sem conjunto, anúncio, orçamento aplicado ou cobrança.</p>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                {portfolio.campaigns.map((campaign) => {
                    const Icon = campaign.id === 'smartphones' ? Smartphone : Store;
                    const periodLimit = calculatePeriodLimit(campaign);
                    return (
                        <article key={campaign.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 bg-slate-50 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm ring-1 ring-slate-200"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-wide text-indigo-500">Campanha {campaign.id === 'smartphones' ? '02' : '01'}</p><h3 className="mt-1 text-xl font-black text-slate-900">{campaign.name}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{campaign.format}</p></div></div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${campaign.authorizedAmount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{campaign.authorizedAmount ? 'Orçamento definido' : 'Aguardando orçamento'}</span>
                                </div>
                            </div>

                            <div className="space-y-5 p-5">
                                <div className="flex flex-wrap gap-2">{campaign.cities.map((city) => <span key={city} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700"><MapPin className="h-3.5 w-3.5" />{city}</span>)}</div>

                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-indigo-600"><Lightbulb className="h-4 w-4" /> Estratégia</p><p className="mt-2 text-sm font-bold text-slate-800">{campaign.strategy}</p><p className="mt-2 text-sm leading-6 text-slate-600"><strong>Por quê:</strong> {campaign.strategyReason}</p></div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Objetivo fixo</p><p className="mt-2 text-sm font-black text-emerald-950">Vendas</p><p className="mt-1 text-xs text-emerald-800">O agente otimiza decisões para gerar pedidos, não apenas cliques ou curtidas.</p></div>
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-green-700"><MessageCircle className="h-3.5 w-3.5" />Destino fixo</p><p className="mt-2 text-sm font-black text-green-950">WhatsApp oficial: {officialWhatsapp || 'cadastro pendente'}</p><p className="mt-1 text-xs text-green-800">O número vem do cadastro da loja e será mostrado no anúncio e validado como destino antes do rascunho.</p></div>
                                </div>

                                <div className="rounded-xl border border-green-200 bg-green-50/60 p-4"><p className="text-xs font-black uppercase tracking-wide text-green-700">Mensagem preparada para o bot</p><code className="mt-2 block rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-800 ring-1 ring-green-100">{campaign.whatsappMessageTemplate}</code><p className="mt-2 text-xs leading-5 text-green-900"><strong>Por quê:</strong> {campaign.botInstruction}</p></div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Tipo de orçamento</span><select value={campaign.budgetType} onChange={(event) => updateCampaign(campaign.id, { budgetType: event.target.value as MarketingCampaignBlueprint['budgetType'] })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500"><option value="daily">Diário</option><option value="lifetime">Total/vitalício</option></select></label>
                                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Valor autorizado</span><div className="relative mt-2"><span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">R$</span><input type="number" min="0" step="1" value={campaign.authorizedAmount ?? ''} onChange={(event) => updateCampaign(campaign.id, { authorizedAmount: event.target.value ? Number(event.target.value) : null })} className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" placeholder="0,00" /></div></label>
                                    <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Duração/revisão</span><div className="relative mt-2"><input type="number" min="1" max="90" value={campaign.durationDays} onChange={(event) => updateCampaign(campaign.id, { durationDays: Math.max(1, Number(event.target.value || 1)) })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-12 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" /><span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">dias</span></div></label>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><CircleDollarSign className="h-4 w-4 text-emerald-600" /> Limite calculado do período</span><strong className="text-lg text-slate-900">{periodLimit ? money.format(periodLimit) : 'A definir'}</strong></div>
                                    <p className="mt-2 text-xs text-slate-500">Este é o teto autorizado, não uma ordem para gastar tudo. Qualquer redistribuição ou aumento precisará de explicação e aprovação.</p>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" /><div><h3 className="font-black text-emerald-900">O que acontece depois de salvar</h3><p className="mt-1 text-sm leading-6 text-emerald-800">O agente audita conta, histórico, mensuração, estoque e criativos; apresenta orçamento sugerido e alternativas; prepara os rascunhos; e envia cada ativação para Aprovações. Salvar aqui não ativa nem gasta nada.</p></div></div>
            </div>
        </div>
    );
}
