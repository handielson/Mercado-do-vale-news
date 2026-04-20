import React from 'react';
import { CheckCircle2, ClipboardList, Printer, RefreshCw, RotateCcw, ShoppingCart, XCircle } from 'lucide-react';
import { getDashboardSalesDigest } from '../../../services/dashboardSalesDigestService';
import {
  buildPurchaseQueueClipboardText,
  getPurchaseQueueItems,
  reopenPurchaseQueueItem,
  syncPurchaseQueueFromSummary,
  updatePurchaseQueueItemStatus,
} from '../../../services/purchaseQueueService.js';

type QueueItem = Awaited<ReturnType<typeof getPurchaseQueueItems>>[number];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(cents) || 0) / 100);
}

function buildStatusBadge(status: string) {
  if (status === 'purchased') {
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  if (status === 'not_purchased') {
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  }

  if (status === 'removed') {
    return 'bg-rose-100 text-rose-700 border border-rose-200';
  }

  return 'bg-blue-100 text-blue-700 border border-blue-200';
}

function statusLabel(status: string) {
  if (status === 'purchased') return 'Comprado';
  if (status === 'not_purchased') return 'Nao comprado';
  if (status === 'removed') return 'Removido';
  return 'Pendente';
}

export const DashboardPurchaseQueue: React.FC = () => {
  const requestRef = React.useRef(0);
  const [state, setState] = React.useState<{
    items: QueueItem[];
    loading: boolean;
    error: string;
    actionId: string;
  }>({
    items: [],
    loading: true,
    error: '',
    actionId: '',
  });

  const loadQueue = React.useCallback(async (syncWithDigest = true) => {
    const requestId = ++requestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      if (syncWithDigest) {
        const digest = await getDashboardSalesDigest();
        const digestDate = digest.referenceDate ? new Date(`${digest.referenceDate}T12:00:00`) : new Date();
        await syncPurchaseQueueFromSummary(digest.summaryRows, digestDate);
      }

      const items = await getPurchaseQueueItems();
      if (requestRef.current !== requestId) return;

      setState({
        items,
        loading: false,
        error: '',
        actionId: '',
      });
    } catch (error) {
      console.error('[DashboardPurchaseQueue] error:', error);
      if (requestRef.current !== requestId) return;

      try {
        const items = await getPurchaseQueueItems();
        if (requestRef.current !== requestId) return;

        setState({
          items,
          loading: false,
          error: 'A fila foi exibida, mas a sincronizacao diaria nao concluiu agora.',
          actionId: '',
        });
      } catch {
        if (requestRef.current !== requestId) return;
        setState({
          items: [],
          loading: false,
          error: 'Nao foi possivel carregar a fila de compra.',
          actionId: '',
        });
      }
    }
  }, []);

  React.useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  const handleStatusChange = React.useCallback(async (item: QueueItem, status: 'purchased' | 'not_purchased' | 'removed') => {
    const needsReason = status === 'not_purchased' || status === 'removed';
    const reason = needsReason
      ? window.prompt(
        status === 'removed'
          ? 'Informe o motivo para retirar este item da lista de compra:'
          : 'Informe o motivo para nao comprar este item agora:',
        item.reason || '',
      )
      : '';

    if (needsReason && !reason?.trim()) return;

    setState((prev) => ({ ...prev, actionId: item.id }));

    try {
      const items = await updatePurchaseQueueItemStatus(item.id, status, reason || '');
      setState((prev) => ({
        ...prev,
        items,
        actionId: '',
      }));
    } catch (error) {
      console.error('[DashboardPurchaseQueue] status error:', error);
      setState((prev) => ({
        ...prev,
        actionId: '',
        error: 'Nao foi possivel atualizar o status deste item.',
      }));
    }
  }, []);

  const handleReopen = React.useCallback(async (item: QueueItem) => {
    setState((prev) => ({ ...prev, actionId: item.id }));

    try {
      const items = await reopenPurchaseQueueItem(item.id);
      setState((prev) => ({
        ...prev,
        items,
        actionId: '',
      }));
    } catch (error) {
      console.error('[DashboardPurchaseQueue] reopen error:', error);
      setState((prev) => ({
        ...prev,
        actionId: '',
        error: 'Nao foi possivel recolocar este item na fila.',
      }));
    }
  }, []);

  const handleCopy = React.useCallback(async () => {
    const text = buildPurchaseQueueClipboardText(state.items.filter((item) => item.status === 'pending'));
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Lista de compra copiada para a area de transferencia.');
    } catch {
      window.alert(text);
    }
  }, [state.items]);

  const handlePrint = React.useCallback(() => {
    const text = buildPurchaseQueueClipboardText(state.items.filter((item) => item.status === 'pending'));
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Compra</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [state.items]);

  const totals = React.useMemo(() => state.items.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status as keyof typeof acc] = (acc[item.status as keyof typeof acc] || 0) + 1;
    return acc;
  }, {
    total: 0,
    pending: 0,
    purchased: 0,
    not_purchased: 0,
    removed: 0,
  }), [state.items]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Fila de Compra</h3>
            <p className="mt-1 text-sm text-slate-500">
              Lista persistente de reposicao alimentada pelo consolidado diario. Itens retirados podem ser recolocados depois.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadQueue(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <RefreshCw size={16} className={state.loading ? 'animate-spin' : ''} />
              Atualizar fila
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ClipboardList size={16} />
              Copiar
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Printer size={16} />
              Imprimir
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Itens</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{state.loading ? '...' : totals.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Pendentes</p>
            <p className="mt-2 text-2xl font-bold text-blue-900">{state.loading ? '...' : totals.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Comprados</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{state.loading ? '...' : totals.purchased}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Nao comprados</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{state.loading ? '...' : totals.not_purchased}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Removidos</p>
            <p className="mt-2 text-2xl font-bold text-rose-900">{state.loading ? '...' : totals.removed}</p>
          </div>
        </div>

        {state.error && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.error}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Modelo</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">SKU</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Estoque Atual</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Compra</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Ult. Venda</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Qtde Acumulada</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Origens</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Motivo</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {state.loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-slate-400" />
                      Sincronizando fila de compra...
                    </td>
                  </tr>
                ) : state.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      <ShoppingCart size={20} className="mx-auto mb-2 text-slate-300" />
                      Nenhum item na fila de compra neste momento.
                    </td>
                  </tr>
                ) : (
                  state.items.map((item) => {
                    const busy = state.actionId === item.id;

                    return (
                      <tr key={item.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.model}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{item.current_stock}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.last_purchase_price_cents)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(item.last_sale_price_cents)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.accumulated_quantity}</td>
                        <td className="px-4 py-3 text-slate-600">{Array.isArray(item.origin_channels) ? item.origin_channels.join(', ') : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${buildStatusBadge(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.reason || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-[240px] flex-wrap gap-2">
                            {item.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleStatusChange(item, 'purchased')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  <CheckCircle2 size={14} />
                                  Comprado
                                </button>
                                <button
                                  onClick={() => handleStatusChange(item, 'not_purchased')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                                >
                                  <XCircle size={14} />
                                  Nao comprar
                                </button>
                                <button
                                  onClick={() => handleStatusChange(item, 'removed')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                                >
                                  <XCircle size={14} />
                                  Remover
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleReopen(item)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60"
                              >
                                <RotateCcw size={14} />
                                Recolocar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
