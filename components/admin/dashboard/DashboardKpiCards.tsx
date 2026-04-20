import React from 'react';
import { getDashboardDailyMetrics } from '../../../services/dashboardMetricsService.js';

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
  const [state, setState] = React.useState({
    revenueCents: 0,
    profitCents: 0,
    salesCount: 0,
    referenceDate: '',
    periodMode: 'today',
    loading: true,
    error: '',
  });

  React.useEffect(() => {
    let active = true;

    getDashboardDailyMetrics()
      .then((metrics) => {
        if (!active) return;
        setState({
          revenueCents: metrics.revenueCents,
          profitCents: metrics.profitCents,
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
          <p className="text-xs font-semibold uppercase text-slate-500">Lucro do Dia</p>
          <p className="mt-1 text-2xl font-bold">{state.loading ? 'Carregando...' : formatCurrency(state.profitCents)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-violet-500 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Vendas do Dia</p>
          <p className="mt-1 text-2xl font-bold">{state.loading ? 'Carregando...' : state.salesCount}</p>
        </div>
      </div>
    </div>
  );
};
