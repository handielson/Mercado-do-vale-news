import React from 'react';
import { AlertTriangle, DollarSign } from 'lucide-react';
import type { MarketplaceFinancialLine, MarketplaceSale } from '../../../services/adminMarketplaceSalesService';
import { ProductCostItemRow } from './ProductCostItemRow';

interface Props {
    sale: MarketplaceSale;
    isRefreshing: boolean;
    onCostSaved?: () => void;
}

function money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

function percent(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value.toFixed(1).replace('.', ',')}%`;
}

const STATE_BADGE: Record<string, { label: string; className: string }> = {
    final: { label: 'Valores finais', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    estimated: { label: 'Estimado', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    unavailable: { label: 'Indisponível', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function Line({ line, strong = false }: { line: MarketplaceFinancialLine; strong?: boolean }) {
    return (
        <div className={`flex justify-between gap-4 ${strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
            <span>{line.label}</span>
            <span className={`whitespace-nowrap ${line.amount_cents < 0 ? 'text-rose-600' : ''}`}>
                {line.amount_cents < 0 ? `− ${money(Math.abs(line.amount_cents))}` : money(line.amount_cents)}
            </span>
        </div>
    );
}

// marketplace-sale-financials-ml-tiktok-v1: Shopee, Mercado Livre e TikTok Shop usam o mesmo resumo;
// a origem diz se os valores são reais do marketplace ou estimados pelas taxas configuradas.
const FINANCIAL_CHANNELS = new Set(['shopee_mv', 'shopee_g', 'mercado_livre', 'tiktok']);

const MARKETPLACE_NAME: Record<string, { of: string; by: string }> = {
    shopee_mv: { of: 'da Shopee', by: 'pela Shopee' },
    shopee_g: { of: 'da Shopee', by: 'pela Shopee' },
    mercado_livre: { of: 'do Mercado Livre', by: 'pelo Mercado Livre' },
    tiktok: { of: 'do TikTok Shop', by: 'pelo TikTok Shop' },
};

export function MarketplaceSaleFinancialSummary({ sale, isRefreshing, onCostSaved }: Props) {
    const financial = sale.details?.financial;
    const supportsFinancial = FINANCIAL_CHANNELS.has(sale.channel);
    const marketplaceName = MARKETPLACE_NAME[sale.channel] || { of: `de ${sale.channel_label}`, by: `por ${sale.channel_label}` };

    if (!financial) {
        return (
            <div className="border-t border-slate-200 p-5">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><DollarSign size={16} className="text-slate-400" />Financeiro da venda</h4>
                <p className="text-sm text-slate-500">
                    {supportsFinancial && isRefreshing
                        ? 'Consultando valor recebido, taxas e custos…'
                        : supportsFinancial
                            ? 'Não foi possível carregar o financeiro desta venda. Use o botão de atualizar.'
                            : 'O detalhamento de taxas e lucro está disponível para vendas da Shopee, do Mercado Livre e do TikTok Shop.'}
                </p>
            </div>
        );
    }

    const isConfiguredEstimate = financial.origin === 'configured_fees';
    // Shopee (sem origin) mantém só o selo de situação. ML/TikTok mostram a origem dos valores;
    // valor real ainda sujeito a mudança aparece como "Provisório" para não confundir com estimativa.
    const badge = financial.origin === 'marketplace' && financial.state === 'estimated'
        ? { label: 'Provisório', className: STATE_BADGE.estimated.className }
        : STATE_BADGE[financial.state] || STATE_BADGE.unavailable;
    const originBadge = isConfiguredEstimate
        ? { label: 'Estimado pelas taxas configuradas', className: 'bg-amber-50 text-amber-800 border-amber-300' }
        : financial.origin === 'marketplace' && financial.payout_cents != null
            ? { label: `Real ${marketplaceName.of}`, className: 'bg-blue-50 text-blue-700 border-blue-200' }
            : null;
    const payoutLabel = financial.payout_label || 'Repasse da Shopee';
    const profitLabel = isConfiguredEstimate ? 'Lucro estimado' : 'Lucro real';
    const cost = financial.cost;
    const hasPayout = financial.payout_cents != null;
    const profit = financial.profit_cents ?? null;
    const costLabel = cost && !cost.complete && cost.items.length ? 'Custo (incompleto)' : 'Custo dos produtos';

    return (
        <div className="border-t border-slate-200 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-semibold text-slate-800"><DollarSign size={16} className="text-slate-400" />Financeiro da venda</h4>
                <div className="flex flex-wrap items-center gap-1.5">
                    {originBadge && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${originBadge.className}`}>{originBadge.label}</span>}
                    {!isConfiguredEstimate && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>}
                </div>
            </div>
            {financial.note && <p className="mb-3 text-xs text-slate-500">{financial.note}</p>}

            {hasPayout && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Valor da venda</p>
                        <p className="font-bold text-slate-900">{money(financial.product_revenue_cents)}</p>
                    </div>
                    <div className="rounded-xl border border-rose-100 p-3">
                        <p className="text-xs text-rose-600">Taxas e ajustes</p>
                        <p className="font-bold text-rose-700">− {money(financial.marketplace_deductions_cents)}</p>
                        <p className="text-[11px] text-slate-400">{percent(financial.marketplace_deductions_pct)} da venda</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">{costLabel}</p>
                        <p className="font-bold text-slate-900">− {money(cost?.total_cents)}</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${profit != null && profit < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <p className={`text-xs ${profit != null && profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{profitLabel}</p>
                        <p className={`font-bold ${profit != null && profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(profit)}</p>
                        <p className="text-[11px] text-slate-500">Margem {percent(financial.margin_pct)}</p>
                    </div>
                </div>
            )}

            {hasPayout && (
                <div className="space-y-1.5 rounded-xl border border-slate-200 p-4 text-sm">
                    {(financial.revenue_lines || []).map((line) => <Line key={line.key} line={line} />)}
                    {(financial.revenue_lines || []).length > 1 && (
                        <Line line={{ key: 'net', label: 'Valor da venda', amount_cents: financial.product_revenue_cents || 0 }} strong />
                    )}
                    {(financial.fee_lines || []).map((line) => <Line key={line.key} line={line} />)}
                    <div className="mt-2 border-t border-slate-100 pt-2">
                        <Line line={{ key: 'payout', label: isConfiguredEstimate ? `${payoutLabel} (estimado)` : payoutLabel, amount_cents: financial.payout_cents || 0 }} strong />
                    </div>
                    <Line line={{ key: 'cost', label: costLabel, amount_cents: -(cost?.total_cents || 0) }} />
                    <div className="mt-2 flex justify-between gap-4 border-t border-slate-100 pt-2 font-bold">
                        <span className={profit != null && profit < 0 ? 'text-red-700' : 'text-emerald-700'}>{profitLabel}</span>
                        <span className={profit != null && profit < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(profit)}</span>
                    </div>
                    {financial.buyer_paid_cents != null && (
                        <p className="pt-1 text-xs text-slate-400">Total pago pelo comprador (com frete e subsídios {marketplaceName.of}): {money(financial.buyer_paid_cents)}</p>
                    )}
                </div>
            )}

            {cost && cost.items.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Custo por item</p>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                        {cost.items.map((item, index) => (
                            <ProductCostItemRow
                                key={`${item.sku || item.name}-${index}`}
                                item={item}
                                context={`marketplace_sale:${sale.channel}:${sale.external_id}`}
                                onSaved={() => onCostSaved?.()}
                            />
                        ))}
                    </div>
                    {!cost.complete && (
                        <p className="mt-2 flex items-start gap-2 text-xs text-amber-700">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            {cost.missing_count} item(ns) sem custo de compra cadastrado. O {profitLabel.toLowerCase()} acima não desconta esse custo.
                        </p>
                    )}
                    <p className="mt-2 text-[11px] text-slate-400">Custo pelo custo de compra atual do produto; ao alterar, o financeiro é recalculado. Impostos (Simples Nacional) não estão incluídos.</p>
                </div>
            )}

            {(financial.raw_fields || []).length > 0 && (
                <details className="mt-4 text-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">Todos os valores informados {marketplaceName.by}</summary>
                    <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        {(financial.raw_fields || []).map((field) => (
                            <div key={field.key} className="flex justify-between gap-4 text-slate-600">
                                <span>{field.label}</span>
                                <span className="whitespace-nowrap">{money(field.amount_cents)}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}
