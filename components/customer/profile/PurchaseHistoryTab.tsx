import React, { useState, useEffect } from 'react';
import { ShoppingBag, Package, RefreshCw, Receipt } from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { getSales } from '../../../services/saleService';
import { supabase } from '../../../services/supabase';
import { companySettingsService } from '../../../services/companySettingsService';
import { SaleWithItems } from '../../../types/sale';
import { printSaleReceipt } from '../../../utils/printSaleReceipt';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);

const paymentLabel = (m: string): string =>
    ({ money: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX' }[m] || m);

export const PurchaseHistoryTab: React.FC = () => {
    const { customer } = useSupabaseAuth();
    const [sales, setSales] = useState<SaleWithItems[]>([]);
    const [productSpecs, setProductSpecs] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);
    const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);

    const handlePrintReceipt = async (sale: SaleWithItems) => {
        setPrintingReceiptId(sale.id);
        try {
            const settings = await companySettingsService.get();
            if (settings) printSaleReceipt(sale, settings, productSpecs);
        } catch (e) {
            console.error(e);
        } finally {
            setPrintingReceiptId(null);
        }
    };

    useEffect(() => {
        if (!customer?.id) return;
        (async () => {
            try {
                const data = await getSales({ customer_id: customer.id });
                setSales(data);
                const allIds = [...new Set(data.flatMap(s => s.items.map(i => (i as any).product_id)).filter(Boolean))];
                if (allIds.length) {
                    const { data: prods } = await supabase.from('products').select('id,specs').in('id', allIds);
                    if (prods) {
                        const map: Record<string, Record<string, string>> = {};
                        prods.forEach(p => { map[p.id] = p.specs || {}; });
                        setProductSpecs(map);
                    }
                }
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin text-blue-600" size={28} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Histórico de Compras</h2>
            <p className="text-slate-600 mb-6">
                Acompanhe todas as suas compras realizadas
            </p>

            {sales.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                        <ShoppingBag className="text-slate-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhuma compra realizada
                    </h3>
                    <p className="text-slate-600 mb-6">
                        Você ainda não realizou compras. Explore nosso catálogo!
                    </p>
                    <a
                        href="/cliente/catalogo"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        <Package size={20} />
                        Ver Catálogo
                    </a>
                </div>
            ) : (
                <div className="space-y-4">
                    {sales.map(sale => {
                        const payments: any[] = (sale as any).payment_methods || [];
                        return (
                            <div key={sale.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header do pedido */}
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">
                                                Pedido #{sale.id.slice(0, 8).toUpperCase()}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(sale.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit', month: 'long', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePrintReceipt(sale)}
                                            disabled={printingReceiptId === sale.id}
                                            title="Imprimir Recibo"
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                                        >
                                            {printingReceiptId === sale.id
                                                ? <RefreshCw size={13} className="animate-spin" />
                                                : <Receipt size={13} />}
                                            Recibo
                                        </button>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-orange-100 text-orange-800'
                                            }`}>
                                            {sale.status === 'completed' ? 'Concluída' :
                                                sale.status === 'cancelled' ? 'Cancelada' : 'Estornada'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* Itens */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Itens</h4>
                                        <div className="space-y-3">
                                            {sale.items.map((item, idx) => {
                                                const specs = productSpecs[(item as any).product_id] || {};
                                                const idParts: string[] = [];
                                                if (specs.imei1) idParts.push(`IMEI 1: ${specs.imei1}`);
                                                if (specs.imei2) idParts.push(`IMEI 2: ${specs.imei2}`);
                                                if (specs.serial) idParts.push(`Serial: ${specs.serial}`);
                                                const identifier = idParts.length > 0
                                                    ? idParts.join(' | ')
                                                    : (item.product_sku ? `SKU: ${item.product_sku}` : null);
                                                return (
                                                    <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-800">
                                                                {item.quantity > 1 && <span className="mr-1.5 text-slate-500">{item.quantity}x</span>}
                                                                {item.product_name}
                                                            </div>
                                                            {identifier && <div className="text-xs text-slate-400 mt-0.5">{identifier}</div>}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800 ml-4">{fmt(item.total)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Resumo + Pagamento */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Resumo</h4>
                                            <div className="space-y-1 text-sm">
                                                {sale.discount_total > 0 && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Descontos</span>
                                                        <span className="text-orange-600">- {fmt(sale.discount_total)}</span>
                                                    </div>
                                                )}
                                                {(sale as any).delivery_total > 0 && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Entrega</span>
                                                        <span>+ {fmt((sale as any).delivery_total)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                                                    <span>Total</span>
                                                    <span>{fmt(sale.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Pagamento</h4>
                                            <div className="space-y-1">
                                                {payments.map((p: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span className="text-slate-600">
                                                            {paymentLabel(p.method)}
                                                            {p.method === 'credit' && p.installments > 1 && ` ${p.installments}x`}
                                                        </span>
                                                        <span className="font-medium text-slate-800">{fmt(p.total_with_fee || p.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
