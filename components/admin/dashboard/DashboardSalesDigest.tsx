import React from 'react';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { getDashboardSalesDigest } from '../../../services/dashboardSalesDigestService';
import { useDashboardSensitiveAccess } from './DashboardSensitiveAccess';

type DigestState = Awaited<ReturnType<typeof getDashboardSalesDigest>>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(cents) || 0) / 100);
}

function formatProtectedCurrency(cents: number, unlocked: boolean) {
  return unlocked ? formatCurrency(cents) : 'R$ ••••••';
}

const emptyDigest: DigestState = {
  detailedRows: [],
  summaryRows: [],
  referenceDate: '',
  periodMode: 'today',
  totals: {
    lines: 0,
    quantity: 0,
    revenueCents: 0,
  },
  warnings: [],
};

export const DashboardSalesDigest: React.FC = () => {
  const { unlocked: sensitiveUnlocked } = useDashboardSensitiveAccess();
  const requestRef = React.useRef(0);
  const [state, setState] = React.useState<{
    data: DigestState;
    loading: boolean;
    error: string;
  }>({
    data: emptyDigest,
    loading: true,
    error: '',
  });

  const loadDigest = React.useCallback(() => {
    const requestId = ++requestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    getDashboardSalesDigest()
      .then((data) => {
        if (requestRef.current !== requestId) return;
        setState({
          data,
          loading: false,
          error: '',
        });
      })
      .catch(() => {
        if (requestRef.current !== requestId) return;
        setState({
          data: emptyDigest,
          loading: false,
          error: 'Nao foi possivel carregar o consolidado de vendas do dia.',
        });
      });
  }, []);

  React.useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Vendas do Dia</h3>
            <p className="mt-1 text-sm text-slate-500">
              Consolidado detalhado por origem, com resumo final por modelo e SKU.
            </p>
            {!state.loading && state.data.referenceDate && (
              <p className="mt-2 text-sm text-slate-500">
                {state.data.periodMode === 'latest'
                  ? `Sem vendas hoje. Exibindo o ultimo dia com movimento em ${new Date(`${state.data.referenceDate}T12:00:00`).toLocaleDateString('pt-BR')}.`
                  : `Referencia de hoje: ${new Date(`${state.data.referenceDate}T12:00:00`).toLocaleDateString('pt-BR')}.`}
              </p>
            )}
          </div>
          <button
            onClick={loadDigest}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linhas do Dia</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {state.loading ? '...' : state.data.totals.lines}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade Vendida</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {state.loading ? '...' : state.data.totals.quantity}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receita Consolidada</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {state.loading ? '...' : formatCurrency(state.data.totals.revenueCents)}
            </p>
          </div>
        </div>

        {state.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {!state.error && state.data.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.data.warnings.join(' ')}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Hora</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Origem</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Modelo</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">SKU</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Qtde</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Estoque Atual</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Compra</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {state.loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-slate-400" />
                      Carregando consolidado de vendas...
                    </td>
                  </tr>
                ) : state.data.detailedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      <ShoppingBag size={20} className="mx-auto mb-2 text-slate-300" />
                      Nenhuma venda consolidada encontrada no periodo atual.
                    </td>
                  </tr>
                ) : (
                  state.data.detailedRows.map((row) => (
                    <tr key={`${row.channelKey}-${row.saleId}-${row.sku}-${row.timestamp}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(row.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {row.originLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.model}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.sku || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.currentStock}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatProtectedCurrency(row.lastPurchasePriceCents, sensitiveUnlocked)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(row.lastSalePriceCents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Resumo Consolidado</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-500">Modelo</th>
                <th className="px-4 py-3 font-semibold text-slate-500">SKU</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Canais</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Qtde Total</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Estoque Atual</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Compra</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Venda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {state.loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Preparando resumo consolidado...
                  </td>
                </tr>
              ) : state.data.summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Sem itens para consolidar no periodo atual.
                  </td>
                </tr>
              ) : (
                state.data.summaryRows.map((row) => (
                  <tr key={`summary-${row.sku}-${row.model}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.model}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.sku || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.channels}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.currentStock}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatProtectedCurrency(row.lastPurchasePriceCents, sensitiveUnlocked)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(row.lastSalePriceCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
