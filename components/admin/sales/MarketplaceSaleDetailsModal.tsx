import React, { useEffect, useState } from 'react';
import { Printer, RefreshCw, X } from 'lucide-react';
import { formatMarketplaceStatus, getMarketplaceSaleDetail, type MarketplaceSale } from '../../../services/adminMarketplaceSalesService';
import { companySettingsService } from '../../../services/companySettingsService';
import { printMarketplaceSaleReceipt } from '../../../utils/printMarketplaceSaleReceipt';
import { SaleItemInventoryInfo } from './SaleItemInventoryInfo';

interface Props {
    sale: MarketplaceSale | null;
    onClose: () => void;
}

function money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(value) || 0) / 100);
}

export default function MarketplaceSaleDetailsModal({ sale, onClose }: Props) {
    if (!sale) return null;
    return <MarketplaceSaleDetailsContent key={`${sale.channel}:${sale.external_id}:${sale.connection_id || ''}`} sale={sale} onClose={onClose} />;
}

function MarketplaceSaleDetailsContent({ sale: initialSale, onClose }: { sale: MarketplaceSale; onClose: () => void }) {
    const [sale, setSale] = useState(initialSale);
    const [isRefreshing, setIsRefreshing] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);
    const refresh = async () => {
        setIsRefreshing(true);
        try { setSale(await getMarketplaceSaleDetail(initialSale)); } finally { setIsRefreshing(false); }
    };
    useEffect(() => { void refresh(); }, []);
    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            const settings = await companySettingsService.get();
            if (!settings) throw new Error('Configurações da empresa não encontradas.');
            printMarketplaceSaleReceipt(sale, settings);
        } catch (error: any) {
            window.alert(error?.message || 'Não foi possível gerar o comprovante.');
        } finally { setIsPrinting(false); }
    };
    const items = Array.isArray(sale.details?.items) ? sale.details.items : [];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 p-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{sale.channel_label}</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900">Pedido {sale.display_id || sale.external_id}</h3>
                        <p className="mt-1 text-sm text-slate-500">Situação consultada diretamente no marketplace</p>
                    </div>
                    <div className="flex items-center gap-1"><button onClick={() => void refresh()} disabled={isRefreshing} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Atualizar situação"><RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /></button><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar"><X size={20} /></button></div>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                    <div className="min-w-0"><p className="text-xs text-slate-500">Cliente</p><p className="break-words font-medium text-slate-800 [overflow-wrap:anywhere]">{sale.customer_name}</p></div>
                    <div><p className="text-xs text-slate-500">Situação no marketplace</p><p className="font-medium text-slate-800">{formatMarketplaceStatus(sale.status)}</p><p className="mt-1 text-[11px] text-slate-400">{isRefreshing ? 'Atualizando…' : 'Atualizado agora'}</p></div>
                    <div className="min-w-0"><p className="text-xs text-slate-500">Total</p><p className="whitespace-nowrap font-bold text-slate-900">{money(sale.total_cents)}</p></div>
                </div>
                <div className="border-t border-slate-200 p-5">
                    <h4 className="mb-3 font-semibold text-slate-800">Itens ({items.length})</h4>
                    {items.length ? (
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {items.map((item, index) => (
                                <div key={`${item.sku || item.name}-${index}`} className="flex items-start justify-between gap-4 p-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                                        <p className="text-xs text-slate-500">{item.sku || 'Sem SKU'}{item.variation ? ` · ${item.variation}` : ''} · {item.quantity} un.</p>
                                        <div className="mt-2">
                                            <SaleItemInventoryInfo name={item.name} sku={item.sku} variation={item.variation} imageUrl={item.image_url} />
                                        </div>
                                    </div>
                                    <p className="whitespace-nowrap text-sm font-semibold text-slate-800">{money(item.total_cents)}</p>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-500">O marketplace não retornou os itens deste pedido.</p>}
                </div>
                <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4"><button onClick={() => void handlePrint()} disabled={isPrinting} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">{isPrinting ? <RefreshCw size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir comprovante</button></div>
            </div>
        </div>
    );
}
