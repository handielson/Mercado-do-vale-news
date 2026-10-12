import React from 'react';
import { ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { getOpenAiFinance, type OpenAiFinance } from '../../services/openAiFinanceService';
const usd = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(n);
const number = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
export function OpenAiFinanceView({ data, error }: { data: OpenAiFinance | null; error: string | null }) {
  const costs = data?.costs;
  const monthly = new Map<string, number>();
  if (data?.days === 365) for (const day of costs?.daily || []) monthly.set(day.date.slice(0, 7), (monthly.get(day.date.slice(0, 7)) || 0) + day.cost_usd);
  const chart = data?.days === 365 ? [...monthly].map(([date, cost_usd]) => ({ date, cost_usd })) : costs?.daily || [];
  const maxDaily = Math.max(0.000001, ...chart.map(d => d.cost_usd));
  return <>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Gasto confirmado no período</p><p className="mt-2 text-3xl font-semibold text-emerald-950">{costs ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(costs.total_usd) : '—'}</p><p className="mt-2 text-xs text-emerald-800">Toda a organização OpenAI · USD · dias em UTC</p></div>
      <div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-600">Saldo pré-pago</p><a className="mt-2 inline-flex items-center gap-2 font-semibold text-blue-600" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer">Conferir saldo na OpenAI <ExternalLink size={15}/></a><p className="mt-2 text-xs leading-5 text-slate-500">A API pública de custos informa gastos. O saldo e as recargas ficam no faturamento da OpenAI.</p></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error} {data ? 'Os dados abaixo são da última consulta bem-sucedida.' : ''}</p>}
    {data && !costs && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{data.status === 'missing_admin_key' ? 'Configure a Admin API key na seção ChatGPT para consultar os gastos.' : 'A OpenAI não retornou os custos. Tente atualizar novamente.'}</p>}
    {costs && <>
      <div><h4 className="font-semibold text-slate-800">{data?.days === 365 ? 'Gastos por mês' : 'Gastos por dia'}</h4><div className="mt-3 flex h-28 items-end gap-1 overflow-x-auto rounded-lg bg-slate-50 px-3 pt-2" aria-label="Gráfico de gastos em USD, UTC">{chart.map(day => <div key={day.date} className="flex h-full min-w-1 flex-1 items-end" title={`${day.date}: ${usd(day.cost_usd)}`}><div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(day.cost_usd > 0 ? 2 : 0, day.cost_usd / maxDaily * 100)}%` }}/></div>)}</div><p className="mt-1 text-xs text-slate-500">{costs.daily[0]?.date} a {costs.daily.at(-1)?.date}</p></div>
      <div className="grid gap-4 lg:grid-cols-2"><div><h4 className="font-semibold text-slate-800">Em que foi gasto</h4><div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Modelo / tipo de cobrança</th><th className="py-2 text-right">Custo</th></tr></thead><tbody>{costs.items.map(item => <tr key={item.name} className="border-t border-slate-100"><td className="py-2 pr-3 break-all">{item.name}</td><td className="whitespace-nowrap py-2 text-right">{usd(item.cost_usd)}</td></tr>)}</tbody></table></div>{!costs.items.length && <p className="text-sm text-slate-500">Sem cobranças registradas no período.</p>}</div>
      <div><h4 className="font-semibold text-slate-800">Gastos por projeto</h4>{costs.projects.map(project => <div key={project.name} className="mt-2 flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="break-all">{project.name}</span><strong>{usd(project.cost_usd)}</strong></div>)}<p className="mt-3 text-xs leading-5 text-slate-500">Uma mesma chave pode ser usada pelo bot e pelo cadastro de produtos. Modelo e projeto identificam a cobrança; a finalidade precisa ser conferida nos registros de cada aplicação.</p></div></div>
    </>}
    {data?.models && <div className="overflow-x-auto"><h4 className="mb-2 font-semibold text-slate-800">Uso por modelo</h4><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Modelo</th><th>Chamadas</th><th>Entrada</th><th>Em cache*</th><th>Saída</th></tr></thead><tbody>{data.models.map(model => <tr className="border-t border-slate-100" key={model.model}><td className="py-2 pr-3">{model.model}</td><td>{number(model.requests)}</td><td>{number(model.input_tokens)}</td><td>{number(model.cached_tokens)}</td><td>{number(model.output_tokens)}</td></tr>)}</tbody></table><p className="mt-2 text-xs text-slate-500">*Tokens em cache já estão incluídos na entrada. Outros serviços aparecem na discriminação de custos acima.</p></div>}
    {data && data.models === null && <p className="text-sm text-slate-500">A discriminação de tokens por modelo não está disponível nesta consulta.</p>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{data?.updated_at ? `Consultado em ${new Date(data.updated_at).toLocaleString('pt-BR')}` : 'Aguardando consulta'}</span><a className="text-blue-600" href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer">Abrir histórico completo na OpenAI ↗</a></div>
  </>;
}
export function OpenAiFinancePanel() {
  const [days, setDays] = React.useState(30);
  const [data, setData] = React.useState<OpenAiFinance | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    setData(previous => previous?.days === days ? previous : null);
    async function update() {
      if (!stopped) setLoading(true);
      try {
        const result = await getOpenAiFinance(days);
        if (!stopped) { setData(result); setError(null); }
      } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Falha ao consultar custos.'); }
      finally { if (!stopped) { setLoading(false); timer = setTimeout(() => { if (document.visibilityState === 'visible') void update(); else timer = setTimeout(update, 60000); }, 60000); } }
    }
    void update();
    return () => { stopped = true; clearTimeout(timer); };
  }, [days, revision]);
  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><Wallet size={22} className="text-emerald-600"/> Créditos e gastos OpenAI</h3><p className="mt-1 text-sm text-slate-500">Consulta automática a cada minuto. Os dados podem ter atraso de processamento na OpenAI.</p></div><div className="flex gap-2"><select aria-label="Período de gastos OpenAI" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg border p-2 text-sm"><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={365}>Últimos 12 meses</option></select><button type="button" disabled={loading} onClick={() => setRevision(n => n+1)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>{loading ? 'Consultando…' : 'Atualizar'}</button></div></div>
    <OpenAiFinanceView data={data} error={error}/>
  </section>;
}
