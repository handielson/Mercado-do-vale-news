import React from 'react';
import { Link } from 'react-router-dom';
import { buildShopeeDashboardLinks, getDashboardShopeeCounts } from '../../../services/dashboardShopeeService.js';

export const DashboardShopeePanel: React.FC = () => {
  const [state, setState] = React.useState<{
    loading: boolean;
    error: string;
    entries: ReturnType<typeof buildShopeeDashboardLinks>;
  }>({
    loading: true,
    error: '',
    entries: [],
  });

  React.useEffect(() => {
    let active = true;

    getDashboardShopeeCounts()
      .then((counts) => {
        if (!active) return;
        setState({
          loading: false,
          error: '',
          entries: buildShopeeDashboardLinks(counts),
        });
      })
      .catch((error) => {
        console.error('[DashboardShopeePanel] error:', error);
        if (!active) return;
        setState({
          loading: false,
          error: 'Não foi possível carregar a operação da Shopee.',
          entries: [],
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <span>🛍️</span> Shopee
        </h3>
        <Link to="/admin/settings/shopee" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Abrir painel
        </Link>
      </div>

      {state.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(state.loading ? new Array(5).fill(null) : state.entries).map((entry, index) => (
          entry ? (
            <Link
              key={entry.key}
              to={entry.href}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all"
            >
              <p className="text-xs font-semibold text-slate-500 uppercase">{entry.label}</p>
              <p className="text-2xl font-bold mt-2 text-slate-900">{entry.count}</p>
            </Link>
          ) : (
            <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-pulse">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-8 w-12 rounded bg-slate-200 mt-3" />
            </div>
          )
        ))}
      </div>
    </div>
  );
};
