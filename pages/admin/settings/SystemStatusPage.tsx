import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, HelpCircle, RefreshCw, Search, Settings2, XCircle } from 'lucide-react';
import { readSystemStatusSource } from '../../../services/systemStatusService';
import { failedSystemStatusCheck, initialSystemStatusChecks, interpretSystemStatus, systemStatusDefinitions, type SystemStatusState } from '../../../services/systemStatusModel';

const REFRESH_MS = 60000;
const groups = ['Infraestrutura', 'Comunicação', 'Publicações', 'Integrações'] as const;
const stateStyles: Record<SystemStatusState, { color: string; Icon: typeof Activity }> = {
  healthy: { color: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  warning: { color: 'bg-amber-50 text-amber-900 border-amber-200', Icon: AlertTriangle },
  error: { color: 'bg-rose-50 text-rose-800 border-rose-200', Icon: XCircle },
  configured: { color: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Settings2 },
  unconfigured: { color: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Settings2 },
  unknown: { color: 'bg-slate-50 text-slate-600 border-slate-200', Icon: HelpCircle },
};
const when = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function SystemStatusPage({ readSource = readSystemStatusSource }: { readSource?: typeof readSystemStatusSource } = {}) {
  const [checks, setChecks] = useState(initialSystemStatusChecks);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const sources = [...new Set(systemStatusDefinitions.map(c => c.source).filter((s): s is string => Boolean(s)))];
    try {
      await Promise.allSettled(sources.map(async source => {
        try {
          const data = await readSource(source);
          if (!mounted.current) return;
          const now = new Date();
          const summaries = new Map(systemStatusDefinitions.filter(check => check.source === source).map(check => [check.id, interpretSystemStatus(check.id, data, now)]));
          setChecks(current => current.map(check => check.source === source ? { ...check, ...summaries.get(check.id)!, checkedAt: now.toISOString() } : check));
        } catch {
          if (mounted.current) setChecks(current => current.map(check => check.source === source ? failedSystemStatusCheck(check, new Date().toISOString()) : check));
        }
      }));
      if (mounted.current) setLastCheck(new Date().toISOString());
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [readSource]);

  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [autoRefresh, refresh]);

  const attention = checks.filter(c => c.state === 'warning' || c.state === 'error').length;
  const noData = checks.filter(c => c.state === 'unknown').length;
  const visible = checks.filter(c => `${c.name} ${c.group} ${c.label}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
    && (filter === 'all' || filter === 'attention' && ['warning', 'error'].includes(c.state) || filter === 'unknown' && c.state === 'unknown'));

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900"><Activity className="text-blue-600" />Status do sistema</h1>
        <p className="mt-2 text-sm text-slate-600">Saúde do Mercado do Vale e das integrações em um só lugar.</p>
        </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />Atualizar a cada 60s</label>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Verificando…' : 'Verificar agora'}</button>
      </div>
    </header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-live="polite">
      {[{ name: 'Operacionais', count: checks.filter(c => c.state === 'healthy').length, style: 'text-emerald-700' },
        { name: 'Precisam de atenção', count: attention, style: 'text-amber-800' },
        { name: 'Configurados / autorizados', count: checks.filter(c => c.state === 'configured').length, style: 'text-blue-700' },
        { name: 'Não configurados / desativados', count: checks.filter(c => c.state === 'unconfigured').length, style: 'text-slate-600' },
        { name: 'Sem diagnóstico', count: noData, style: 'text-slate-600' }].map(item => <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-4"><p className={`text-2xl font-bold ${item.style}`}>{item.count}</p><p className="mt-1 text-xs text-slate-600">{item.name}</p></div>)}
    </div>
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">“Configurado” e “Autorizado” indicam o cadastro da integração. Não confirmam uma publicação, cobrança ou sincronização. Falhas de consulta aparecem como diagnóstico indisponível.</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:w-80"><Search size={16} className="text-slate-400" /><input aria-label="Buscar serviço" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar serviço ou integração" className="min-w-0 w-full bg-transparent text-sm outline-none" /></label>
      <select aria-label="Filtrar diagnósticos" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">Todos os serviços ({checks.length})</option><option value="attention">Precisam de atenção ({attention})</option><option value="unknown">Sem diagnóstico ({noData})</option></select>
    </div>
    <p className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} />{lastCheck ? `Última rodada: ${when(lastCheck)}` : 'Carregando diagnósticos…'} · Horários de Brasília</p>
    {groups.map(group => {
      const cards = visible.filter(c => c.group === group);
      if (!cards.length) return null;
      return <section key={group} aria-label={group} className="space-y-3"><h2 className="text-lg font-bold text-slate-900">{group}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(check => {
        const { color, Icon } = stateStyles[check.state];
        return <article key={check.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">{check.name}</h3>
          <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}><Icon size={13} />{check.label}</span>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{check.detail}</p>
          <div className="mt-4 space-y-1 text-xs text-slate-400">{check.checkedAt && <p>Consultado: {when(check.checkedAt)}</p>}{check.sourceAt && <p>Último registro: {when(check.sourceAt)}</p>}</div>
          <Link to={check.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800">Ver detalhes<ArrowUpRight size={15} /></Link>
        </article>;
      })}</div></section>;
    })}
    {!visible.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">Nenhum serviço encontrado para esse filtro.</p>}
    <Link to="/admin/settings/vps-status" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">Abrir diagnóstico detalhado da VPS e do NAS<ArrowUpRight size={15} /></Link>
  </div>;
}
