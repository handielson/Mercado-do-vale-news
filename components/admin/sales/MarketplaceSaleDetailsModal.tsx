import React from 'react';
import { X } from 'lucide-react';
import type { MarketplaceSale } from '../../../services/adminMarketplaceSalesService';

interface Props {
    sale: MarketplaceSale | null;
    onClose: () => void;
}

function money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(value) || 0) / 100);
}

export default function MarketplaceSaleDetailsModal({ sale, onClose }: Props) {
    if (!sale) return null;
    const items = Array.isArray(sale.details?.items) ? sale.details.items : [];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 p-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{sale.channel_label}</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900">Pedido {sale.display_id || sale.external_id}</h3>
                        <p className="mt-1 text-sm text-slate-500">Consulta somente leitura do marketplace</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-3">
                    <div><p className="text-xs text-slate-500">Cliente</p><p className="font-medium text-slate-800">{sale.customer_name}</p></div>
                    <div><p className="text-xs text-slate-500">Status original</p><p className="font-medium text-slate-800">{sale.status}</p></div>
                    <div><p className="text-xs text-slate-500">Total</p><p className="font-bold text-slate-900">{money(sale.total_cents)}</p></div>
                </div>
                <div className="border-t border-slate-200 p-5">
                    <h4 className="mb-3 font-semibold text-slate-800">Itens ({items.length})</h4>
                    {items.length ? (
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {items.map((item, index) => (
                                <div key={`${item.sku || item.name}-${index}`} className="flex items-start justify-between gap-4 p-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                                        <p className="text-xs text-slate-500">{item.sku || 'Sem SKU'}{item.variation ? ` · ${item.variation}` : ''} · {item.quantity} un.</p>
                                    </div>
                                    <p className="whitespace-nowrap text-sm font-semibold text-slate-800">{money(item.total_cents)}</p>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-500">O marketplace não retornou os itens deste pedido.</p>}
                </div>
            </div>
        </div>
    );
}
