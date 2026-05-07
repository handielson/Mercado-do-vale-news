import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, RefreshCw, Receipt, FileText, ExternalLink, Check, Clock, X, CreditCard, Truck, type LucideIcon } from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { getSales } from '../../../services/saleService';
import { getOrders, cancelOrder } from '../../../services/orderService';
import { supabase } from '../../../services/supabase';
import { companySettingsService } from '../../../services/companySettingsService';
import { SaleWithItems } from '../../../types/sale';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { getCoinBalance } from '../../../services/cashbackService';
import { generateLegacySalePdf } from '../../../utils/legacySalePdfGenerator';
import { benefitService } from '../../../services/benefitService';
import { toast } from 'sonner';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);

const paymentLabel = (m: string): string =>
    ({ money: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX' }[m] || m);

// Fases do pedido online — ordem de progresso. payment_failed e cancelled
// são estados terminais negativos e tratados separadamente.
const ONLINE_ORDER_STAGES: Array<{
    key: string;
    label: string;
    Icon: LucideIcon;
}> = [
    { key: 'awaiting_payment', label: 'Aguardando pagamento', Icon: Clock },
    { key: 'paid', label: 'Pagamento confirmado', Icon: CreditCard },
    { key: 'preparing', label: 'Em preparação', Icon: Package },
    { key: 'shipped', label: 'Enviado', Icon: Truck },
    { key: 'delivered', label: 'Entregue', Icon: Check },
];

function getStageIndex(status: string): number {
    // Mapeia status atual para o índice da fase concluída mais recente.
    // pending e awaiting_payment caem na fase 0 (aguardando pagamento).
    if (status === 'pending' || status === 'awaiting_payment') return 0;
    const idx = ONLINE_ORDER_STAGES.findIndex(s => s.key === status);
    if (idx >= 0) return idx;
    // 'completed' é equivalente ao último estágio (entregue + finalizado)
    if (status === 'completed') return ONLINE_ORDER_STAGES.length - 1;
    return -1;
}

function getStatusBadge(status: string): { label: string; className: string } {
    switch (status) {
        case 'paid':
            return { label: 'Pago', className: 'bg-emerald-100 text-emerald-800' };
        case 'preparing':
            return { label: 'Em preparação', className: 'bg-blue-100 text-blue-800' };
        case 'shipped':
            return { label: 'Enviado', className: 'bg-indigo-100 text-indigo-800' };
        case 'delivered':
            return { label: 'Entregue', className: 'bg-green-100 text-green-800' };
        case 'completed':
            return { label: 'Concluído', className: 'bg-green-100 text-green-800' };
        case 'awaiting_payment':
            return { label: 'Aguardando pagamento', className: 'bg-yellow-100 text-yellow-800' };
        case 'pending':
            return { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' };
        case 'cancelled':
            return { label: 'Cancelado', className: 'bg-red-100 text-red-800' };
        case 'payment_failed':
            return { label: 'Pagamento recusado', className: 'bg-red-100 text-red-800' };
        case 'refunded':
        case 'returned':
            return { label: 'Estornado/Devolvido', className: 'bg-orange-100 text-orange-800' };
        default:
            return { label: status || 'Desconhecido', className: 'bg-slate-100 text-slate-800' };
    }
}

export const PurchaseHistoryTab: React.FC = () => {
    const { customer } = useSupabaseAuth();
    const [sales, setSales] = useState<SaleWithItems[]>([]);
    const [productSpecs, setProductSpecs] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);
    const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);
    const [printingComprovanteId, setPrintingComprovanteId] = useState<string | null>(null);

    const handleViewLegacyComprovante = async (sale: SaleWithItems) => {
        setPrintingComprovanteId(sale.id);
        try {
            const settings = await companySettingsService.get();
            const company = {
                name:    settings?.company_name || 'Mercado do Vale',
                address: settings?.address      || '',
                phone:   settings?.phone        || '',
                cnpj:    settings?.cnpj         || '',
            };
            const items = sale.items.map(item => {
                const sku = item.product_sku || '';
                const imeiParts = sku.split('/').map((s: string) => s.trim());
                return {
                    phone: {
                        id: item.id,
                        device_type: '',
                        imei1: imeiParts[0] || '',
                        imei2: imeiParts[1] || '',
                        brand_id: (item as any).product_brand || '',
                        model: (item as any).product_model || item.product_name || '',
                        version: '',
                        ram:     (item as any).product_specs?.ram || '',
                        storage: (item as any).product_specs?.storage || '',
                        color:   (item as any).product_specs?.color || '',
                        buy_price: 0,
                        sell_price_suggested: item.unit_price || 0,
                        status: '',
                        quantity: item.quantity || 1,
                        condition: 'USED' as const,
                        entry_date: sale.created_at,
                        updated_at: sale.created_at,
                    },
                    brand: undefined,
                    quantity:   item.quantity   || 1,
                    unit_price: item.unit_price || 0,
                    subtotal:   (item.unit_price || 0) * (item.quantity || 1),
                };
            });
            const pdfBlob = await generateLegacySalePdf({
                sale:         { ...sale, sale_date: sale.created_at, total_amount: (sale as any).total_amount ?? 0, payment_method: (sale as any).payment_method || '' } as any,
                customerName: customer?.name || '',
                customerCpf:  (customer as any)?.cpf_cnpj || '',
                items,
                company,
            });
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar comprovante');
        } finally {
            setPrintingComprovanteId(null);
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
                        .then(({ data }) => data?.amount ?? 0, () => 0)
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

                // Map online orders to match the Sale structure for UI compatibility.
                // Preservamos o status original do pedido (awaiting_payment, paid,
                // preparing, shipped, delivered, completed, cancelled, payment_failed)
                // para o cliente ver a fase real, mesmo que o admin altere manualmente.
                const mappedOrders = onlineOrders.map(order => ({
                    id: order.id,
                    created_at: order.created_at,
                    status: order.status,
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
                        installments: 1
                    }],
                    // Campos extras pra renderização rica (pedido online):
                    is_online_order: true,
                    delivery_type: order.delivery_type,
                    payment_gateway: order.payment_gateway,
                    gateway_payment_id: order.gateway_payment_id,
                    gateway_pix_data: order.gateway_pix_data,
                    gateway_payment_url: order.gateway_payment_url,
                })) as unknown as SaleWithItems[];

                // Merge and sort
                const combined = [...pdvSales, ...mappedOrders].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setSales(combined);
                const map: Record<string, Record<string, string>> = {};
                const allIds = [...new Set(combined.flatMap(s => s.items.map(i => (i as any).product_id)).filter(Boolean))];
                if (allIds.length) {
                    const { data: prods } = await supabase.from('products').select('id,specs').in('id', allIds);
                    (prods || []).forEach(p => { map[p.id] = p.specs || {}; });
                }
                // IMEI por sale_item.id — busca units VPS para vendas com items serializados
                try {
                    const { vpsApiService } = await import('../../../services/vpsApiService');
                    for (const sale of combined) {
                        const hasSerialized = sale.items.some((i: any) => i.serialized_unit_id);
                        if (!hasSerialized) continue;
                        const units = await vpsApiService.getUnitsBySale(sale.id);
                        const unitToItem = new Map<string, string>();
                        sale.items.forEach((it: any) => {
                            if (it.serialized_unit_id) unitToItem.set(it.serialized_unit_id, it.id);
                        });
                        (units || []).forEach((u: any) => {
                            const itemId = unitToItem.get(u.id);
                            if (!itemId) return;
                            map[itemId] = {
                                ...(map[itemId] || {}),
                                imei1: u.imei_1 || '',
                                imei2: u.imei_2 || '',
                                serial: u.serial || '',
                            };
                        });
                    }
                } catch (e) { /* fallback: continua sem IMEI da unit */ }
                setProductSpecs(map);
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
                        const isOnlineOrder: boolean = !!(sale as any).is_online_order;
                        const orderStatus: string = String(sale.status);
                        const stageIndex = getStageIndex(orderStatus);
                        const pixTicketUrl: string | undefined = (sale as any).gateway_pix_data?.ticket_url;
                        const paymentGateway: string | undefined = (sale as any).payment_gateway;
                        const gatewayPaymentId: string | undefined = (sale as any).gateway_payment_id;
                        const isTerminalNegative = orderStatus === 'cancelled' || orderStatus === 'payment_failed';
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
                                        {sale.legacy_sale_id && (
                                            <button
                                                onClick={() => handleViewLegacyComprovante(sale)}
                                                disabled={printingComprovanteId === sale.id}
                                                title="Ver Comprovante de Venda"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                                            >
                                                <FileText size={13} />
                                                {printingComprovanteId === sale.id ? 'Gerando...' : 'Ver Comprovante'}
                                            </button>
                                        )}
                                        {!sale.legacy_sale_id && (
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
                                        )}
                                        {(() => {
                                            const badge = getStatusBadge(String(sale.status));
                                            return (
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* Itens */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Itens</h4>
                                        <div className="space-y-3">
                                            {sale.items.map((item, idx) => {
                                                const itemSpecs = productSpecs[(item as any).id] || {};
                                                const productLevel = productSpecs[(item as any).product_id] || {};
                                                const specs = { ...productLevel, ...itemSpecs };
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

                                    {/* Timeline de progresso (somente pedidos online) */}
                                    {isOnlineOrder && (
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Progresso do pedido</h4>
                                            {isTerminalNegative ? (
                                                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                                                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                        <X className="w-5 h-5 text-red-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-red-800">
                                                            {orderStatus === 'cancelled' ? 'Pedido cancelado' : 'Pagamento recusado'}
                                                        </div>
                                                        <div className="text-xs text-red-600 mt-0.5">
                                                            {orderStatus === 'cancelled'
                                                                ? 'Este pedido foi cancelado e não será processado.'
                                                                : 'O pagamento não foi aprovado. Você pode tentar novamente em uma nova compra.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <ol className="flex items-start justify-between gap-1">
                                                    {ONLINE_ORDER_STAGES.map((stage, idx) => {
                                                        const reached = stageIndex >= idx;
                                                        const current = stageIndex === idx;
                                                        const StageIcon = stage.Icon;
                                                        return (
                                                            <li key={stage.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                                                                <div className="flex items-center w-full">
                                                                    <div className={`flex-1 h-0.5 ${idx === 0 ? 'invisible' : reached ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                                                                        reached
                                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                            : 'bg-white border-slate-300 text-slate-400'
                                                                    } ${current ? 'ring-4 ring-emerald-100' : ''}`}>
                                                                        <StageIcon size={14} />
                                                                    </div>
                                                                    <div className={`flex-1 h-0.5 ${idx === ONLINE_ORDER_STAGES.length - 1 ? 'invisible' : (stageIndex > idx ? 'bg-emerald-500' : 'bg-slate-200')}`} />
                                                                </div>
                                                                <span className={`mt-2 text-[11px] leading-tight ${current ? 'font-semibold text-slate-800' : reached ? 'text-slate-600' : 'text-slate-400'}`}>
                                                                    {stage.label}
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            )}

                                            {/* Detalhes do pagamento (gateway) */}
                                            {(pixTicketUrl || gatewayPaymentId) && (
                                                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-xs text-blue-900">
                                                        {paymentGateway === 'mercado_pago' && (
                                                            <div className="font-semibold">Pagamento via Mercado Pago</div>
                                                        )}
                                                        {gatewayPaymentId && (
                                                            <div className="text-blue-700">ID do pagamento: <code className="font-mono">{gatewayPaymentId}</code></div>
                                                        )}
                                                    </div>
                                                    {pixTicketUrl && (
                                                        <a
                                                            href={pixTicketUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                        >
                                                            <ExternalLink size={13} />
                                                            Ver no Mercado Pago
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

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
