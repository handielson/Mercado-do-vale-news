import React from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { getDashboardDailyMetrics } from '../../../services/dashboardMetricsService.js';
import { unlockDashboardProfit } from '../../../services/dashboardMetricsService.js';
import { useDashboardSensitiveAccess } from './DashboardSensitiveAccess';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

function formatReferenceDate(dateKey: string) {
  if (!dateKey) return '';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('pt-BR');
}

export const DashboardKpiCards: React.FC = () => {
  const { unlocked: sensitiveUnlocked, setUnlocked: setSensitiveUnlocked } = useDashboardSensitiveAccess();
  const [state, setState] = React.useState({
    revenueCents: 0,
    profitCents: 0,
    salesCount: 0,
    referenceDate: '',
    periodMode: 'today',
    loading: true,
    error: '',
  });
  const [unlockOpen, setUnlockOpen] = React.useState(false);
  const [profitPassword, setProfitPassword] = React.useState('');
  const [unlocking, setUnlocking] = React.useState(false);
  const [unlockError, setUnlockError] = React.useState('');

  React.useEffect(() => {
    let active = true;

    getDashboardDailyMetrics()
      .then((metrics) => {
        if (!active) return;
        setState({
          revenueCents: metrics.revenueCents,
          profitCents: 0,
          salesCount: metrics.salesCount,
          referenceDate: metrics.referenceDate,
          periodMode: metrics.periodMode,
          loading: false,
          error: '',
        });
      })
      .catch((error) => {
        console.error('[DashboardKpiCards] error:', error);
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Nao foi possivel carregar os indicadores do dia.',
        }));
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleUnlockProfit(event: React.FormEvent) {
    event.preventDefault();
    if (!profitPassword.trim()) {
      setUnlockError('Informe a senha do lucro.');
      return;
    }

    setUnlocking(true);
    setUnlockError('');
    try {
      const result = await unlockDashboardProfit({
        password: profitPassword,
        referenceDate: state.referenceDate,
      });
      setState((prev) => ({
        ...prev,
        profitCents: Number(result?.profitCents) || 0,
      }));
      setSensitiveUnlocked(true);
      setUnlockOpen(false);
      setProfitPassword('');
    } catch (error) {
      console.error('[DashboardKpiCards] profit unlock error:', error);
      setUnlockError('Senha incorreta ou lucro indisponivel.');
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <span>Dados Financeiros</span>
        </h3>
        {!state.loading && state.referenceDate && (
          <p className="text-sm text-slate-500">
            {state.periodMode === 'latest'
              ? `Sem vendas hoje. Exibindo o ultimo movimento em ${formatReferenceDate(state.referenceDate)}.`
              : `Atualizado para ${formatReferenceDate(state.referenceDate)}.`}
          </p>
        )}
      </div>

      {state.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Faturamento do Dia</p>
          <p className="mt-1 text-2xl font-bold">{state.loading ? 'Carregando...' : formatCurrency(state.revenueCents)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-green-500 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Lucro do Dia</p>
              <p className="mt-1 text-2xl font-bold">
                {state.loading ? 'Carregando...' : sensitiveUnlocked ? formatCurrency(state.profitCents) : 'R$ ••••••'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (sensitiveUnlocked) {
                  setSensitiveUnlocked(false);
                  return;
                }
                setUnlockOpen(true);
                setUnlockError('');
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
              title={sensitiveUnlocked ? 'Ocultar valores' : 'Mostrar valores'}
              aria-label={sensitiveUnlocked ? 'Ocultar valores' : 'Mostrar valores'}
              disabled={state.loading}
            >
              {sensitiveUnlocked ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {unlockOpen && !sensitiveUnlocked && (
            <form onSubmit={handleUnlockProfit} className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-500" htmlFor="dashboard-profit-password">
                Senha do lucro
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    id="dashboard-profit-password"
                    type="password"
                    value={profitPassword}
                    onChange={(event) => setProfitPassword(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={unlocking}
                >
                  {unlocking ? '...' : 'OK'}
                </button>
              </div>
              {unlockError && <p className="text-xs font-medium text-red-600">{unlockError}</p>}
            </form>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-violet-500 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Vendas do Dia</p>
          <p className="mt-1 text-2xl font-bold">{state.loading ? 'Carregando...' : state.salesCount}</p>
        </div>
      </div>
    </div>
  );
};
