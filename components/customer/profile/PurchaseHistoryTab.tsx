import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, RefreshCw, Receipt } from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { getSales, deleteSale } from '../../../services/saleService';
import { getOrders, cancelOrder } from '../../../services/orderService';
import { supabase } from '../../../services/supabase';
import { companySettingsService } from '../../../services/companySettingsService';
import { SaleWithItems } from '../../../types/sale';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { getCoinBalance } from '../../../services/cashbackService';
import { benefitService } from '../../../services/benefitService';
import { toast } from 'sonner';

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
    const [isDeleting, setIsDeleting] = useState(false);

    const handleClearPhantomOrders = async () => {
        if (!confirm('ATENÇÃO: Isso apagará PARA SEMPRE todas as compras exibidas abaixo do banco de dados (Ação para limpar dados de teste). Tem certeza?')) return;
        
        setIsDeleting(true);
        try {
            // Separa os IDs de vendas do PDV e pedidos online
            const onlineIds = sales.filter(s => (s as any).payment_methods?.[0]?.method !== undefined && !s.id.includes('-pdv-')).map(s => s.id); // Lógica simples de separação
            
            // Delete online orders directly
            for (const id of onlineIds) {
                await supabase.from('orders').delete().eq('id', id);
            }
            
            // Delete PDV sales
            const pdvIds = sales.filter(s => !onlineIds.includes(s.id)).map(s => s.id);
            for (const id of pdvIds) {
                await deleteSale(id);
            }

            toast.success('Histórico de teste apagado do banco de dados!');
            setSales([]);
        } catch (e: any) {
            console.error(e);
            toast.error('Erro ao apagar pedidos: ' + e.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePrintReceipt = async (sale: SaleWithItems) => {
        setPrintingReceiptId(sale.id);
        try {
            const customerId = customer?.id;
            const [settings, coinBalance, benefitStatuses, coinsThisSale] = await Promise.all([
                companySettingsService.get(),
                customerId ? getCoinBalance(customerId).catch(() => null) : Promise.resolve(null),
                customerId ? benefitService.getCustomerBenefitsStatus(customerId).catch(() => []) : Promise.resolve([]),
                customerId
                    ? supabase
                        .from('coin_transactions')
                        .select('amount')
                        .eq('customer_id', customerId)
                        .eq('reference_id', sale.id)
                        .eq('type', 'earn_purchase')
                        .maybeSingle()
                        .then(({ data }) => data?.amount ?? 0)
                        .catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (!settings) return;
            const benefits: PrintReceiptBenefits = {
                coinBalance,
                coinsEarnedThisSale: coinsThisSale,
                benefitStatuses,
            };
            printSaleReceipt(sale, settings, productSpecs, benefits);
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
                // Fetch PDV Sales and Online Orders simultaneously
                const [pdvSales, onlineOrders] = await Promise.all([
                    getSales({ customer_id: customer.id }),
                    getOrders({ customer_id: customer.id })
                ]);

                // Map online orders to match the Sale structure for UI compatibility
                const mappedOrders = onlineOrders.map(order => ({
                    id: order.id,
                    created_at: order.created_at,
                    status: order.status === 'completed' || order.status === 'paid' ? 'completed' :
                        order.status === 'cancelled' ? 'cancelled' : 'pending',
                    total: order.total,
                    discount_total: order.discount,
                    delivery_total: order.shipping_cost,
                    items: order.items.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        product_name: item.product_name,
                        product_sku: item.product_sku,
                        subtotal: item.subtotal,
                        warranty_months: 0,
                        warranty_price: 0
                    })),
                    payment_methods: [{
                        method: order.payment_method === 'credit_card' ? 'credit' :
                            order.payment_method === 'pix' ? 'pix' :
                                order.payment_method === 'on_delivery' ? 'Dinheiro/Cartão (Entrega)' : 'Dinheiro',
                        amount: order.total,
                        installments: 1 // Simplified for now
                    }]
                })) as unknown as SaleWithItems[];

                // Merge and sort
                const combined = [...pdvSales, ...mappedOrders].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setSales(combined);
                const allIds = [...new Set(combined.flatMap(s => s.items.map(i => (i as any).product_id)).filter(Boolean))];
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

            {/* Painel de DEBUG/Limpeza de Dados Fantasmas */}
            {sales.length > 0 && customer?.id && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="text-red-800 font-bold text-sm">🛠️ Modo Desenvolvedor: Dados Fantasmas?</h4>
                        <p className="text-red-600 text-xs mt-1 leading-relaxed">
                            O sistema encontrou estes pedidos atrelados ao seu UUID <code>{customer.id}</code>.<br/>
                            Se você não fez essas compras, elas foram importadas do WooCommerce ou PDV antigo como teste.<br/>
                            Você pode resetar o histórico deste CPF agora mesmo.
                        </p>
                    </div>
                    <button 
                        onClick={handleClearPhantomOrders}
                        disabled={isDeleting}
                        className="whitespace-nowrap bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                        {isDeleting ? 'Apagando...' : 'Limpar Dados Fantasmas'}
                    </button>
                </div>
            )}

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
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sale.status === 'completed' || sale.status === 'paid' ? 'bg-green-100 text-green-800' :
                                            sale.status === 'pending' || sale.status === 'awaiting_payment' ? 'bg-yellow-100 text-yellow-800' :
                                                sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    sale.status === 'refunded' || sale.status === 'returned' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-slate-100 text-slate-800'
                                            }`}>
                                            {sale.status === 'completed' || sale.status === 'paid' ? 'Concluída' :
                                                sale.status === 'pending' || sale.status === 'awaiting_payment' ? 'Pendente' :
                                                    sale.status === 'cancelled' ? 'Cancelada' :
                                                        sale.status === 'refunded' || sale.status === 'returned' ? 'Estornada/Devolvida' :
                                                            'Desconhecido'}
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
                                                                <Link
                                                                    to={`/?search=${encodeURIComponent(item.product_name)}`}
                                                                    className="hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                                                                >
                                                                    {item.product_name}
                                                                </Link>
                                                            </div>
                                                            {identifier && <div className="text-xs text-slate-400 mt-0.5">{identifier}</div>}
                                                            {(item.warranty_months && item.warranty_months > 0) ? (
                                                                <div className="text-xs text-blue-600 font-medium mt-1">
                                                                    🛡️ Garantia de +{item.warranty_months} Meses (+ {fmt(item.warranty_price || 0)})
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800 ml-4">{fmt(item.subtotal + (item.warranty_price || 0))}</div>
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
                                                        <span>Frete / Entrega</span>
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
