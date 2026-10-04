import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, RefreshCw } from 'lucide-react';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { accountantPortalService, type AccountantRevenueReport } from '../../../services/accountantPortalService';
import { revenueView } from '../../../services/accountantRevenueView';
import { accountingPeriod, calcSimples, currentAccountingCompetence, SIMPLES_ANEXOS } from '../../../services/simplesNacional';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const monthLabel = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
const dateLabel = (value: string) => value.split('-').reverse().join('/');
function initialAnexo() {
    try {
        const stored = JSON.parse(localStorage.getItem('contabilidade_config_v2') || '{}');
        if (Object.hasOwn(SIMPLES_ANEXOS, stored.anexo)) return stored.anexo as string;
    } catch { /* Configuração local indisponível. */ }
    return 'I';
}

export default function AccountingPage() {
    const [competence, setCompetence] = useState(currentAccountingCompetence);
    const [anexo, setAnexo] = useState(initialAnexo);
    // RBT12 manual pertence à competência escolhida. Não reutilizar overrides antigos.
    const [manual, setManual] = useState<{ competence: string; cents: number } | null>(null);
    const [reports, setReports] = useState<{ competence: string; previous: AccountantRevenueReport; current: AccountantRevenueReport } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const requestVersion = useRef(0);
    const period = useMemo(() => accountingPeriod(competence), [competence]);

    useEffect(() => {
        const version = ++requestVersion.current;
        setReports(null);
        setError('');
        setBusy(Boolean(period));
        if (!period) return;
        (async () => {
            try {
                const list = await accountantPortalService.list();
                if (!list.enabled) throw new Error('Cadastro fiscal ainda não ativado no servidor.');
                const company = list.companies.find(item => item.id === 'primary');
                if (!company) throw new Error('Cadastre os dados fiscais da empresa principal para consultar o faturamento.');
                if (company.regime !== 'simples_nacional') throw new Error('A empresa principal não está cadastrada como optante pelo Simples Nacional.');
                const [previous, current] = await Promise.all([
                    accountantPortalService.revenue(company.id, period.from, period.to),
                    accountantPortalService.revenue(company.id, period.currentFrom, period.currentTo),
                ]);
                if (!previous.coverage.available || !current.coverage.available) throw new Error(previous.coverage.reason || current.coverage.reason || 'Faturamento indisponível para esta empresa.');
                if (version === requestVersion.current) setReports({ competence, previous, current });
            } catch (err) {
                if (version === requestVersion.current) setError(err instanceof Error ? err.message : 'Falha ao consultar faturamento.');
            } finally {
                if (version === requestVersion.current) setBusy(false);
            }
        })();
        return () => { ++requestVersion.current; };
    }, [period, competence, refresh]);

    const active = reports?.competence === competence ? reports : null;
    const previousView = active ? revenueView(active.previous, 'all') : null;
    const currentView = active ? revenueView(active.current, 'all') : null;
    const manualCents = manual?.competence === competence ? manual.cents : 0;
    const rbt12Cents = manualCents > 0 ? manualCents : previousView?.totalCents || 0;
    const result = active ? calcSimples(rbt12Cents / 100, anexo) : null;
    const missingMonths = period?.months.filter(month => !active?.previous.months.some(row => row.competence === month)) || [];
    const aboveSublimit = rbt12Cents > 360000000;

    return <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><BookOpen className="text-indigo-600" size={30} /><div><h1 className="text-xl font-black text-slate-800">Contabilidade</h1><p className="text-sm text-slate-500">Faturamento registrado e simulação do Simples Nacional por competência</p></div></div>
            <button type="button" disabled={busy || !period} onClick={() => setRefresh(v => v + 1)} className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} />Atualizar faturamento</button>
        </header>
        <section aria-label="Configurações contábeis" className="grid gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:grid-cols-3">
            <label className="text-sm font-semibold text-indigo-900">Competência de apuração<input type="month" min="2018-01" value={competence} onChange={e => { setCompetence(e.target.value); setManual(null); }} className="mt-2 block w-full rounded-lg border border-indigo-200 bg-white p-2" /></label>
            <label className="text-sm font-semibold text-indigo-900">Anexo do Simples Nacional<select value={anexo} onChange={e => { setAnexo(e.target.value); try { localStorage.setItem('contabilidade_config_v2', JSON.stringify({ anexo: e.target.value })); } catch { /* */ } }} className="mt-2 block w-full rounded-lg border border-indigo-200 bg-white p-2">{Object.entries(SIMPLES_ANEXOS).map(([key, tab]) => <option key={key} value={key}>{tab.name}</option>)}</select></label>
            <div><CurrencyInput label="RBT12 confirmado pelo contador (opcional)" value={manualCents} onChange={cents => setManual({ competence, cents })} /><p className="mt-1 text-xs text-slate-600">Informe o total completo desta competência. Apague para simular com os registros do sistema.</p></div>
            {period && <p className="text-sm text-indigo-900 sm:col-span-3">RBT12 de {dateLabel(period.from)} a {dateLabel(period.to)}: 12 meses completos anteriores à competência. O vencimento do DAS não muda a competência das vendas.</p>}
        </section>
        {!period && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">Escolha uma competência de 2018 a 2026. A regra de apuração a partir de 2027 precisa ser revisada antes de utilizar esta simulação.</p>}
        {busy && <p role="status" className="text-slate-600">Consultando faturamento…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {active && period && <>
            <aside role="note" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p><strong>{manualCents > 0 ? 'Simulação com RBT12 informado.' : 'Prévia com os dados registrados — cobertura não confirmada.'}</strong> O resultado não confirma a faixa declarada no PGDAS-D. Confirme o histórico completo e a segregação das receitas com o contador. Empresas em início de atividade exigem RBT12 proporcionalizado.</p>
                {missingMonths.length > 0 && <p>Meses sem registros operacionais: {missingMonths.map(monthLabel).join(', ')}. Ausência de registros não comprova faturamento zero.</p>}
                <p>Vendas concluídas de todos os canais entram uma vez. Notas fiscais são exibidas separadamente e não são somadas às vendas. Taxas dos marketplaces não são abatidas do faturamento.</p>
                {active.previous.coverage.note && <p>{active.previous.coverage.note}</p>}
            </aside>
            <section aria-label="Resultado do Simples Nacional" className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{manualCents > 0 ? 'RBT12 informado' : 'Faturamento registrado no período do RBT12'}</p><p className="mt-2 text-2xl font-black text-indigo-900">{money(rbt12Cents)}</p></div>
                <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Faixa simulada · Anexo {anexo}</p><p className="mt-2 text-2xl font-black text-indigo-900">{result ? `${result.faixa}ª faixa` : 'Indisponível'}</p>{result && <p className="mt-1 text-sm">Nominal: {percent(result.aliquotaNominal)} · Dedução: {money(result.deducao * 100)}</p>}</div>
                <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Alíquota efetiva da tabela · simulação</p><p className="mt-2 text-2xl font-black text-indigo-900">{result ? percent(result.aliquotaEfetiva) : 'Indisponível'}</p><p className="mt-1 text-xs text-slate-500">Antes dos ajustes por ICMS-ST, monofásicos e outras segregações.</p></div>
            </section>
            {rbt12Cents > 480000000 && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">Receita acima de R$ 4,8 milhões: cálculo bloqueado. Confira com o contador os limites e os efeitos sobre o enquadramento no Simples.</p>}
            {aboveSublimit && result && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">Receita acima de R$ 3,6 milhões: confira o sublimite e o recolhimento de ICMS/ISS fora do DAS. A alíquota da tabela não representa toda a carga tributária.</p>}
            <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Competência {monthLabel(competence)}</h2><p className="mt-2">Vendas concluídas registradas: <strong>{money(currentView?.totalCents || 0)}</strong></p><p className="mt-1">{result && !aboveSublimit ? <>Imposto simulado antes das segregações: <strong>{money(Math.round((currentView?.totalCents || 0) * result.aliquotaEfetiva))}</strong>.</> : 'Imposto simulado indisponível.'}</p><p className="mt-2 text-xs text-slate-500">Competências em andamento contêm apenas os registros disponíveis até a consulta. Este valor não é uma guia DAS.</p></section>
            <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-sm"><caption className="p-4 text-left font-bold">Faturamento por mês no período do RBT12</caption><thead className="bg-slate-50 text-left"><tr><th className="p-3">Mês</th><th className="p-3">Registros operacionais</th><th className="p-3 text-right">Vendas concluídas</th><th className="p-3 text-right">Notas autorizadas (separadas)</th></tr></thead><tbody>{period.months.map(month => {
                const hasRecords = active.previous.months.some(row => row.competence === month);
                const cents = previousView?.months.filter(row => row.month === month).reduce((sum, row) => sum + row.totalCents, 0) || 0;
                const docs = active.previous.documents.filter(doc => doc.issuedAt.slice(0, 7) === month && doc.status === 'authorized' && ['55', '65'].includes(doc.model));
                return <tr key={month} className="border-t"><td className="p-3">{monthLabel(month)}</td><td className="p-3">{hasRecords ? 'Há registros; cobertura a conferir' : 'Sem registros'}</td><td className="p-3 text-right">{hasRecords ? money(cents) : '—'}</td><td className="p-3 text-right">{docs.length ? money(docs.reduce((sum, doc) => sum + doc.totalCents, 0)) : '—'}</td></tr>;
            })}</tbody></table></section>
        </>}
        <p className="text-sm"><Link to="/contador" className="font-semibold text-blue-700 underline">Conferir vendas e notas no Espaço do Contador</Link></p>
        <p className="text-xs text-slate-500">Tabela: <a href="https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp155.htm" target="_blank" rel="noreferrer" className="underline">LC 155/2016, Anexos I a V</a>. A seleção de anexo depende da atividade e, quando aplicável, do fator R.</p>
    </div>;
}
