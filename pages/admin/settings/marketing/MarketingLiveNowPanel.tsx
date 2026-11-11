// marketing-live-now-v1: quadro "No ar agora" da Central de Aprovações — stories agendados, promoções de produtos
// e campanhas automáticas (Marketplace e Status do WhatsApp), cada um com atalho para a tela onde se edita.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Loader2, RefreshCw, Repeat, Store, Tag } from 'lucide-react';
import { socialStoryScheduleService, type SocialStorySchedule } from '../../../../services/socialStoryScheduleService';
import { productPromotionEditPath, promoCampaignService, type ProductPromotionSummary } from '../../../../services/promoCampaignService';
import { facebookMarketplaceCampaignService, type FacebookMarketplaceCampaign } from '../../../../services/facebookMarketplaceCampaignService';
import { whatsappStatusCampaignService, type WhatsAppStatusCampaign } from '../../../../services/whatsappStatusCampaignService';
import { isActiveFlag, storeClockLabel, upcomingStories } from '../../../../utils/marketingLiveNow.js';

type Source<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (time: number | string | null) => {
  if (time === null || time === '') return '';
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const settle = <T,>(promise: Promise<T>): Promise<Source<T>> => promise
  .then(data => ({ status: 'ready' as const, data }))
  .catch(error => ({ status: 'error' as const, message: error instanceof Error ? error.message : 'Não foi possível carregar.' }));

function Box({ title, icon: Icon, count, link, children }: { title: string; icon: typeof Tag; count?: number; link: { to: string; label: string; external?: boolean }; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Icon className="h-4 w-4 text-indigo-600" /> {title}{count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span>}</h3>
        {link.external
          ? <a href={link.to} className="text-xs font-bold text-blue-700 hover:underline">{link.label}</a>
          : <Link to={link.to} className="text-xs font-bold text-blue-700 hover:underline">{link.label}</Link>}
      </div>
      <div className="mt-3 flex-1 space-y-2 text-sm">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-xs text-slate-500">{text}</p>;
const Failure = ({ message, retry }: { message: string; retry: () => void }) => <p role="alert" className="text-xs text-red-700">{message} <button type="button" onClick={retry} className="underline">Tentar de novo</button></p>;
const Loading = () => <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…</p>;

export default function MarketingLiveNowPanel() {
  const [stories, setStories] = useState<Source<SocialStorySchedule[]>>({ status: 'loading' });
  const [promos, setPromos] = useState<Source<ProductPromotionSummary[]>>({ status: 'loading' });
  const [marketplace, setMarketplace] = useState<Source<FacebookMarketplaceCampaign[]>>({ status: 'loading' });
  const [whatsapp, setWhatsapp] = useState<Source<WhatsAppStatusCampaign[]>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [a, b, c, d] = await Promise.all([
      settle(socialStoryScheduleService.list()),
      settle(promoCampaignService.listProductPromotions().then(result => result.promotions || [])),
      settle(facebookMarketplaceCampaignService.listCampaigns()),
      settle(whatsappStatusCampaignService.list()),
    ]);
    setStories(a); setPromos(b); setMarketplace(c); setWhatsapp(d);
    setRefreshing(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upcoming = stories.status === 'ready' ? upcomingStories(stories.data) : [];
  const automatic = [
    ...(marketplace.status === 'ready' ? marketplace.data.map(campaign => ({
      id: `fb-${campaign.id}`, kind: 'Marketplace', title: campaign.title, active: isActiveFlag(campaign.active),
      detail: `${String(campaign.start_time || '').slice(0, 5)}–${String(campaign.end_time || '').slice(0, 5)} · até ${campaign.daily_limit}/dia · a cada ${Math.round(Number(campaign.interval_minutes || 0) / 60 * 10) / 10} h`,
      next: isActiveFlag(campaign.active) && campaign.next_run_at ? `próxima: ${storeClockLabel(campaign.next_run_at)}` : '',
      error: campaign.last_error || '', link: '?tab=facebook',
    })) : []),
    ...(whatsapp.status === 'ready' ? whatsapp.data.map(campaign => ({
      id: `wa-${campaign.id}`, kind: 'Status WhatsApp', title: campaign.title, active: isActiveFlag(campaign.active),
      detail: `${campaign.frequency === 'daily' ? 'diário' : campaign.frequency} · a partir de ${String(campaign.start_time || '').slice(0, 5)}`,
      next: campaign.last_run_at ? `última: ${storeClockLabel(campaign.last_run_at)}` : '',
      error: campaign.last_error_debug ? 'erro na última execução' : '', link: '?tab=whatsapp',
    })) : []),
  ].sort((a, b) => Number(b.active) - Number(a.active));
  const activeAutomatic = automatic.filter(item => item.active);
  const automaticStatus = marketplace.status === 'loading' || whatsapp.status === 'loading' ? 'loading'
    : marketplace.status === 'error' && whatsapp.status === 'error' ? 'error' : 'ready';

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4" aria-label="No ar agora">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900">No ar agora</h2>
          <p className="text-xs text-slate-500">O que está rodando ou agendado em todos os canais, com atalho para editar.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Box title="Stories agendados" icon={CalendarClock} count={stories.status === 'ready' ? upcoming.length : undefined} link={{ to: '?tab=calendar', label: 'Abrir calendário', external: true }}>
          {stories.status === 'loading' && <Loading />}
          {stories.status === 'error' && <Failure message={stories.message} retry={() => void load()} />}
          {stories.status === 'ready' && !upcoming.length && <Empty text="Nenhum story agendado." />}
          {upcoming.slice(0, 6).map(({ schedule, next }) => (
            <div key={schedule.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="font-bold text-slate-800">{when(next)} · {schedule.title}</p>
              <p className="text-xs text-slate-500">{(schedule.destinations || []).map(item => item === 'whatsapp' ? 'WhatsApp' : 'Instagram').join(' + ')} · {(schedule.items || []).length} mídia(s)</p>
            </div>
          ))}
          {upcoming.length > 6 && <p className="text-xs text-slate-500">+{upcoming.length - 6} no calendário.</p>}
        </Box>

        <Box title="Promoções de produtos" icon={Tag} count={promos.status === 'ready' ? promos.data.length : undefined} link={{ to: '/admin/promotions', label: 'Central de Promoções' }}>
          {promos.status === 'loading' && <Loading />}
          {promos.status === 'error' && <Failure message={promos.message} retry={() => void load()} />}
          {promos.status === 'ready' && !promos.data.length && <Empty text="Nenhuma promoção ativa ou agendada." />}
          {promos.status === 'ready' && promos.data.slice(0, 6).map(promo => (
            <div key={promo.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div>
                <p className="font-bold text-slate-800">{promo.modelName} {promo.version}</p>
                <p className="text-xs text-slate-500"><span className="line-through">{money(promo.retailCents)}</span> por <strong className="text-red-700">{money(promo.promoCents)}</strong> · {promo.status === 'active' ? 'ativa' : 'agendada'}{promo.end ? ` até ${when(promo.end)}` : ''}</p>
              </div>
              <Link to={productPromotionEditPath(promo)} className="shrink-0 text-xs font-bold text-blue-700 hover:underline">Editar</Link>
            </div>
          ))}
        </Box>

        <Box title="Campanhas automáticas" icon={Repeat} count={automaticStatus === 'ready' ? activeAutomatic.length : undefined} link={{ to: '?tab=facebook', label: 'Marketplace', external: true }}>
          {automaticStatus === 'loading' && <Loading />}
          {automaticStatus === 'error' && <Failure message="Não foi possível carregar as campanhas automáticas." retry={() => void load()} />}
          {automaticStatus === 'ready' && !automatic.length && <Empty text="Nenhuma campanha automática criada." />}
          {automatic.map(item => (
            <div key={item.id} className={`rounded-lg border px-3 py-2 ${item.active ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-800"><Store className="mr-1 inline h-3.5 w-3.5 text-slate-500" />{item.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{item.active ? 'Ativa' : 'Desligada'}</span>
              </div>
              <p className="text-xs text-slate-500">{item.kind} · {item.detail}{item.next ? ` · ${item.next}` : ''}</p>
              {item.error && item.active && <p className="text-xs font-semibold text-rose-700">⚠ {item.error}</p>}
              <a href={item.link} className="text-xs font-bold text-blue-700 hover:underline">Editar</a>
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}
